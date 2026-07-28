import { defineConfig } from 'vitest/config';

const mysqlIntegrationProjects =
  process.env.AGENT_PROTOCOL_MYSQL_E2E === '1'
    ? [
        {
          extends: true,
          test: {
            name: 'mysql-integration',
            include: [
              'src/tests/integration/agent-protocol-oauth-mysql.test.ts',
            ],
            environment: 'node',
            testTimeout: 30000,
          },
        },
      ]
    : [];

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'contract',
          include: ['src/tests/contract/**/*.test.ts'],
          environment: 'node',
          testTimeout: 10000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/tests/integration/mcp-protocol.test.ts'],
          environment: 'node',
          testTimeout: 30000,
        },
      },
      ...mysqlIntegrationProjects,
    ],
  },
});
