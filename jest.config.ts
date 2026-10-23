import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx", esModuleInterop: true } }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/apps/frontend/src/$1",
    "^@cookwhat/shared$": "<rootDir>/packages/shared/src/index.ts",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/e2e/"],
};

export default config;
