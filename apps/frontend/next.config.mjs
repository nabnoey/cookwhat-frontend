import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@cookwhat/shared"],
};

export default nextConfig;
