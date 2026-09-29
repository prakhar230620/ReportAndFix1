import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
export default (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    distDir: process.env.NEXT_DIST_DIR || (isDev ? ".next" : ".next-build"),
  };
};
