import * as fs from "fs";
import path from "path";

/**
 * Ensure variables.json exists in tmp directory
 * If docs/tmp/variables.json exists, use it; otherwise copy from docs/variables.json
 * @param {Object} config - Configuration object with working_directory property
 */
export const ensureVariablesJson = (config) => {
  const getConfigPath = (config, relativePath) => {
    return path.join(config.working_directory, relativePath);
  };

  const tmpVariablesPath = getConfigPath(config, "tmp/variables.json");
  const sourceVariablesPath = getConfigPath(config, "variables.json");

  // If tmp/variables.json already exists, use it
  if (fs.existsSync(tmpVariablesPath)) {
    console.log("Using existing tmp/variables.json");
    return;
  }

  // If source variables.json exists, copy it to tmp
  if (fs.existsSync(sourceVariablesPath)) {
    const tmpDir = path.dirname(tmpVariablesPath);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    fs.copyFileSync(sourceVariablesPath, tmpVariablesPath);
    console.log("Copied variables.json to tmp/variables.json");
  } else {
    console.log("Warning: variables.json not found in source directory");
  }
};
