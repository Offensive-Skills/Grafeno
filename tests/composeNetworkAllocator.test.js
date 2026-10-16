const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCidr,
  cidrsOverlap,
  parseNetworkTemplates,
  renderComposeTemplate,
  allocateDynamicSubnets,
  findAllocationConflicts
} = require('../controllers/composeNetworkAllocator');

test('CIDR overlap detects containing and disjoint prefixes', () => {
  assert.equal(cidrsOverlap('10.12.0.0/16', '10.12.8.0/24'), true);
  assert.equal(cidrsOverlap('10.12.0.0/24', '10.12.1.0/24'), false);
  assert.deepEqual(parseCidr('192.168.4.19/24'), {
    cidr: '192.168.4.0/24',
    prefix: 24,
    start: 3232236544,
    end: 3232236799
  });
});

test('template parser discovers dynamic subnet and relative IP offsets', () => {
  const template = [
    'subnet: "${GRAFENO_SUBNET_RED1_24}"',
    'gateway: "${GRAFENO_IP_RED1_1}"',
    'c1: "${GRAFENO_IP_RED1_13}"',
    'c2: "${GRAFENO_IP_RED1_27}"',
    'c3: "${GRAFENO_IP_RED1_41}"'
  ].join('\n');
  const networks = parseNetworkTemplates(template);
  assert.equal(networks.red1.prefix, 24);
  assert.deepEqual([...networks.red1.offsets].sort((a, b) => a - b), [13, 27, 41]);
});

test('renderer substitutes assigned network CIDRs and preserves host offsets', () => {
  const template = [
    'subnet: "${GRAFENO_SUBNET_RED1_24}"',
    'gateway: "${GRAFENO_IP_RED1_1}"',
    'c1: "${GRAFENO_IP_RED1_13}"',
    'c2: "${GRAFENO_IP_RED1_27}"'
  ].join('\n');
  const rendered = renderComposeTemplate(template, { red1: '10.244.17.0/24' });
  assert.match(rendered, /subnet: "10\.244\.17\.0\/24"/);
  assert.match(rendered, /gateway: "10\.244\.17\.1"/);
  assert.match(rendered, /c1: "10\.244\.17\.13"/);
  assert.match(rendered, /c2: "10\.244\.17\.27"/);
  assert.doesNotMatch(rendered, /\$\{GRAFENO_/);
});

test('allocator skips occupied and explicitly rejected CIDRs', () => {
  const specs = { red1: { prefix: 24, offsets: new Set([13, 27, 41]) } };
  const assigned = allocateDynamicSubnets(specs, {
    hostCidrs: ['10.240.0.0/24'],
    dockerNetworks: [{ cidr: '10.240.2.0/24', project: null, logicalName: null }],
    projectName: 'grafeno_382',
    reusable: []
  }, { red1: ['10.240.1.0/24'] }, {
    pools: ['10.240.0.0/22'],
    startIndices: { '10.240.0.0/22': 0 }
  });
  assert.deepEqual(assigned, { red1: '10.240.3.0/24' });
});

test('post-up check treats the matching Ligolo route as owned but catches a later route collision', () => {
  const assignments = { red1: '10.240.2.0/24' };
  const networkState = {
    projectName: 'grafeno_382',
    hostCidrs: [],
    hostRoutes: [
      { cidr: '10.240.2.0/24', dev: 'tun0-ligolo' },
      { cidr: '10.240.2.0/24', dev: 'wlp9s0' }
    ],
    dockerNetworks: []
  };
  assert.deepEqual(findAllocationConflicts(assignments, networkState), { red1: '10.240.2.0/24' });
  networkState.hostRoutes = [{ cidr: '10.240.2.0/24', dev: 'tun0-ligolo' }];
  assert.deepEqual(findAllocationConflicts(assignments, networkState), {});
});

test('allocator reuses a stored red1 subnet for the matching Ligolo route', () => {
  const specs = { red1: { prefix: 24, offsets: new Set([13, 27, 41]) } };
  const cidr = '10.240.2.0/24';
  const assigned = allocateDynamicSubnets(specs, {
    hostCidrs: [cidr],
    hostRoutes: [{ cidr, dev: 'tun0-ligolo' }],
    dockerNetworks: [],
    projectName: 'grafeno_382',
    reusable: [{ name: 'red1', cidr }]
  });
  assert.deepEqual(assigned, { red1: cidr });
});

test('allocator avoids the previous fixed bridge and Ligolo prefixes', () => {
  const specs = { red1: { prefix: 24, offsets: new Set([13, 27, 41]) } };
  const assigned = allocateDynamicSubnets(specs, {
    hostCidrs: ['172.30.0.0/24', '192.168.101.0/24'],
    hostRoutes: [
      { cidr: '172.30.0.0/24', dev: 'br-existing' },
      { cidr: '192.168.101.0/24', dev: 'tun0-ligolo' }
    ],
    dockerNetworks: [{ cidr: '192.168.100.0/24', project: null, logicalName: null }],
    projectName: 'grafeno_382',
    reusable: []
  }, {}, {
    pools: ['172.30.0.0/24', '192.168.100.0/22'],
    startIndices: { '172.30.0.0/24': 0, '192.168.100.0/22': 0 }
  });
  assert.deepEqual(assigned, { red1: '192.168.102.0/24' });
});

test('post-up checker ignores the project bridge route but catches a foreign route', () => {
  const networkState = {
    projectName: 'grafeno_382',
    hostCidrs: ['172.28.0.0/24', '10.240.2.0/24'],
    hostRoutes: [
      { cidr: '172.28.0.0/24', dev: 'br-a1b2c3d4e5f6' },
      { cidr: '10.240.2.0/24', dev: 'tun0-ligolo' }
    ],
    dockerNetworks: [
      { cidr: '172.28.0.0/24', project: 'grafeno_382', logicalName: 'red_mgmt', driver: 'bridge', bridgeDevice: 'br-a1b2c3d4e5f6' },
      { cidr: '10.240.2.0/24', project: 'grafeno_382', logicalName: 'red1', driver: 'macvlan' }
    ]
  };
  assert.deepEqual(findAllocationConflicts({ red1: '10.240.2.0/24' }, networkState), {});
  networkState.hostRoutes.push({ cidr: '10.240.2.0/24', dev: 'wlp9s0' });
  assert.deepEqual(findAllocationConflicts({ red1: '10.240.2.0/24' }, networkState), { red1: '10.240.2.0/24' });
});
