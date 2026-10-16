const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const SUBNET_TOKEN = /\$\{GRAFENO_SUBNET_([A-Z0-9_]+)_(\d{1,2})\}/g;
const IP_TOKEN = /\$\{GRAFENO_IP_([A-Z0-9_]+)_(\d{1,3})\}/g;
const ANY_INTERPOLATION = /\$\{[^}]+\}/g;
const DEFAULT_POOLS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '100.64.0.0/10',
  '198.18.0.0/15'
];

function ipv4ToInt(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    throw new Error(`Dirección IPv4 inválida: ${address}`);
  }
  return (((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0;
}

function intToIpv4(value) {
  const unsigned = value >>> 0;
  return [
    (unsigned >>> 24) & 255,
    (unsigned >>> 16) & 255,
    (unsigned >>> 8) & 255,
    unsigned & 255
  ].join('.');
}

function parseCidr(cidr) {
  if (typeof cidr !== 'string') throw new Error('CIDR inválido.');
  const [address, prefixText] = cidr.split('/');
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error(`Prefijo CIDR inválido: ${cidr}`);
  const ip = ipv4ToInt(address);
  const size = 2 ** (32 - prefix);
  const start = Math.floor(ip / size) * size;
  return { cidr: `${intToIpv4(start)}/${prefix}`, prefix, start, end: start + size - 1 };
}

function cidrsOverlap(left, right) {
  const a = typeof left === 'string' ? parseCidr(left) : left;
  const b = typeof right === 'string' ? parseCidr(right) : right;
  return a.start <= b.end && b.start <= a.end;
}

function parseNetworkTemplates(composeYaml) {
  const allTokens = composeYaml.match(ANY_INTERPOLATION) || [];
  const subnetTokens = [...composeYaml.matchAll(SUBNET_TOKEN)];
  const ipTokens = [...composeYaml.matchAll(IP_TOKEN)];
  const recognized = [...subnetTokens, ...ipTokens].map((match) => match[0]);
  if (allTokens.length !== recognized.length || allTokens.some((token) => !recognized.includes(token))) {
    throw new Error('La plantilla contiene una interpolación no reconocida por Grafeno.');
  }

  const networks = {};
  for (const [, name, prefixText] of subnetTokens) {
    const network = name.toLowerCase();
    const prefix = Number(prefixText);
    if (prefix !== 24 || networks[network]) throw new Error(`Definición dinámica de red inválida: ${network}`);
    networks[network] = { prefix, subnetTokenCount: 1, gatewayTokenCount: 0, offsets: new Set() };
  }

  for (const [, name, offsetText] of ipTokens) {
    const network = name.toLowerCase();
    const offset = Number(offsetText);
    const definition = networks[network];
    if (!definition || offset < 1 || offset > 254) throw new Error(`Offset IP dinámico inválido para ${network}.`);
    if (offset === 1) {
      if (definition.gatewayTokenCount) throw new Error(`Gateway dinámico duplicado en ${network}.`);
      definition.gatewayTokenCount = 1;
    } else {
      if (definition.offsets.has(offset)) throw new Error(`Offset IP dinámico duplicado en ${network}.`);
      definition.offsets.add(offset);
    }
  }

  for (const [name, definition] of Object.entries(networks)) {
    if (definition.gatewayTokenCount !== 1 || definition.offsets.size === 0) {
      throw new Error(`La red ${name} necesita un gateway .1 y al menos una IP estática templated.`);
    }
  }
  return networks;
}

function renderComposeTemplate(composeYaml, assignedSubnets) {
  let rendered = composeYaml.replace(SUBNET_TOKEN, (_token, name) => {
    const cidr = assignedSubnets[name.toLowerCase()];
    if (!cidr) throw new Error(`No se ha asignado CIDR a la red ${name}.`);
    return cidr;
  });
  rendered = rendered.replace(IP_TOKEN, (_token, name, offsetText) => {
    const cidr = assignedSubnets[name.toLowerCase()];
    if (!cidr) throw new Error(`No se ha asignado CIDR a la red ${name}.`);
    const subnet = parseCidr(cidr);
    const offset = Number(offsetText);
    if (offset <= 0 || offset >= subnet.end - subnet.start) throw new Error(`Offset IP fuera de la red ${name}.`);
    return intToIpv4(subnet.start + offset);
  });
  if (ANY_INTERPOLATION.test(rendered)) throw new Error('Quedaron placeholders sin resolver en el Compose.');
  ANY_INTERPOLATION.lastIndex = 0;
  return rendered;
}

async function executeJson(command, args) {
  const { stdout } = await execFileAsync(command, args, { maxBuffer: 10 * 1024 * 1024 });
  try {
    return JSON.parse(stdout || '[]');
  } catch {
    throw new Error(`No se pudo interpretar la salida de ${command}.`);
  }
}

async function inspectNetworkState(challengeID, reusableSubnets = {}) {
  const [routes, interfaces, networkIdsText] = await Promise.all([
    executeJson('ip', ['-j', '-4', 'route', 'show', 'table', 'all']),
    executeJson('ip', ['-j', '-4', 'addr', 'show']),
    execFileAsync('docker', ['network', 'ls', '-q'], { maxBuffer: 10 * 1024 * 1024 }).then(({ stdout }) => stdout)
  ]);

  const hostRoutes = [];
  for (const route of routes) {
    const destination = route.dst;
    if (!destination || destination === 'default' || destination === '0.0.0.0/0') continue;
    try {
      hostRoutes.push({ cidr: parseCidr(destination).cidr, dev: route.dev || null });
    } catch {
      continue;
    }
  }
  for (const iface of interfaces) {
    for (const info of iface.addr_info || []) {
      if (info.family !== 'inet' || !info.local || !Number.isInteger(info.prefixlen)) continue;
      try {
        hostRoutes.push({ cidr: parseCidr(`${info.local}/${info.prefixlen}`).cidr, dev: iface.ifname || null });
      } catch {
        continue;
      }
    }
  }

  const networkIds = networkIdsText.split(/\s+/).filter(Boolean);
  const networks = networkIds.length ? await executeJson('docker', ['network', 'inspect', ...networkIds]) : [];
  const dockerNetworks = [];
  for (const network of networks) {
    const project = network.Labels?.['com.docker.compose.project'] || null;
    const logicalName = network.Labels?.['com.docker.compose.network'] || null;
    const bridgeDevice = network.Options?.['com.docker.network.bridge.name'] || `br-${String(network.Id || '').slice(0, 12)}`;
    for (const config of network.IPAM?.Config || []) {
      if (config.Subnet && !config.Subnet.includes(':')) dockerNetworks.push({
        cidr: parseCidr(config.Subnet).cidr,
        project,
        logicalName,
        driver: network.Driver,
        bridgeDevice
      });
    }
  }

  const projectName = `grafeno_${challengeID}`;
  const reusable = Object.entries(reusableSubnets).map(([name, cidr]) => ({
    name,
    cidr: parseCidr(cidr).cidr
  }));
  return { hostRoutes, hostCidrs: hostRoutes.map((route) => route.cidr), dockerNetworks, projectName, reusable };
}

function allocateDynamicSubnets(networkTemplates, networkState, excluded = {}, options = {}) {
  const occupiedDocker = networkState.dockerNetworks.filter((network) => {
    if (network.project !== networkState.projectName) return true;
    const reusable = networkState.reusable.find((item) => item.cidr === network.cidr && item.name === network.logicalName);
    return !reusable;
  }).map((network) => network.cidr);
  const occupied = [...occupiedDocker];
  const assignments = {};
  const pools = options.pools || DEFAULT_POOLS;
  const startIndices = options.startIndices || {};

  for (const [name, definition] of Object.entries(networkTemplates)) {
    const candidates = [];
    for (const pool of pools) {
      const base = parseCidr(pool);
      if (base.prefix > definition.prefix) continue;
      const blockSize = 2 ** (32 - definition.prefix);
      const count = 2 ** (definition.prefix - base.prefix);
      const startIndex = Number.isInteger(startIndices[pool])
        ? ((startIndices[pool] % count) + count) % count
        : crypto.randomInt(count);
      for (let index = 0; index < count; index++) {
        const subnetStart = base.start + (((startIndex + index) % count) * blockSize);
        candidates.push(`${intToIpv4(subnetStart)}/${definition.prefix}`);
      }
    }

    const previous = networkState.reusable.find((item) => item.name === name)?.cidr;
    const hostCidrs = (networkState.hostRoutes || networkState.hostCidrs.map((cidr) => ({ cidr, dev: null })))
      .filter((route) => !isExpectedLigoloRoute(route, name, previous))
      .map((route) => route.cidr);
    const allOccupied = [...occupied, ...hostCidrs, ...(excluded[name] || [])];
    const selected = previous && !allOccupied.some((cidr) => cidrsOverlap(previous, cidr))
      ? previous
      : candidates.find((cidr) => !allOccupied.some((used) => cidrsOverlap(cidr, used)));
    if (!selected) throw new Error(`No se encontró un prefijo libre para la red ${name}; revisa rutas, VPNs y redes Docker activas.`);
    assignments[name] = selected;
    occupied.push(selected);
  }
  return assignments;
}

function isExpectedLigoloRoute(route, logicalName, allocatedCidr) {
  return logicalName === 'red1'
    && route.dev === 'tun0-ligolo'
    && route.cidr === allocatedCidr;
}

function findAllocationConflicts(assignments, networkState) {
  const conflicts = {};
  const hostRoutes = networkState.hostRoutes || networkState.hostCidrs.map((cidr) => ({ cidr, dev: null }));
  for (const [logicalName, cidr] of Object.entries(assignments)) {
    const overlappingRoutes = hostRoutes.some((route) =>
      !isExpectedLigoloRoute(route, logicalName, cidr) && cidrsOverlap(cidr, route.cidr));
    const overlappingNetworks = networkState.dockerNetworks.some((network) => {
      if (network.project === networkState.projectName && network.logicalName === logicalName && network.cidr === cidr) return false;
      return cidrsOverlap(cidr, network.cidr);
    });
    if (overlappingRoutes || overlappingNetworks) conflicts[logicalName] = cidr;
  }

  for (const network of networkState.dockerNetworks) {
    if (network.project !== networkState.projectName || network.driver !== 'bridge') continue;
    const conflictingHostRoute = hostRoutes.some((route) =>
      route.dev !== network.bridgeDevice && cidrsOverlap(network.cidr, route.cidr));
    const conflictingDockerNetwork = networkState.dockerNetworks.some((other) =>
      other !== network
      && !(other.project === networkState.projectName && Object.values(assignments).includes(other.cidr))
      && cidrsOverlap(network.cidr, other.cidr));
    if (conflictingHostRoute || conflictingDockerNetwork) conflicts[network.logicalName || 'bridge'] = network.cidr;
  }
  return conflicts;
}

async function selectDynamicSubnets(challengeID, networkTemplates, reusableSubnets, excluded) {
  const networkState = await inspectNetworkState(challengeID, reusableSubnets);
  return allocateDynamicSubnets(networkTemplates, networkState, excluded);
}

async function findPostUpConflicts(challengeID, assignments) {
  const networkState = await inspectNetworkState(challengeID, assignments);
  return findAllocationConflicts(assignments, networkState);
}

module.exports = {
  parseCidr,
  cidrsOverlap,
  parseNetworkTemplates,
  renderComposeTemplate,
  allocateDynamicSubnets,
  findAllocationConflicts,
  selectDynamicSubnets,
  findPostUpConflicts
};
