import * as fs from "fs";
import path from "path";
import axios from "axios";
import { Octokit } from "octokit";
import { CLOUD_TOC_LIST, getAllMdList } from "./getMdListByTOC.js";
import { ensureVariablesJson } from "./ensureVariablesJson.js";

const GH_TOKEN = process.env.GH_TOKEN || "";

// whitelist files: allow download non-md files
const WHITELIST_FILENAMES = ["variables.json"];

const parseCommaSeparatedList = (value) => {
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const normalizeRepoPath = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
};

const normalizeFolder = (folder) => {
  const normalized = normalizeRepoPath(folder).replace(/\/+$/, "");
  if (normalized === "" || normalized === ".") {
    return "";
  }
  return normalized;
};

const normalizeFolders = (folders) => {
  if (!Array.isArray(folders)) {
    return [];
  }
  const normalized = folders.map(normalizeFolder).filter(Boolean);
  return Array.from(new Set(normalized));
};

const isPathInFolders = (filePath, folders) => {
  const scopedFolders = normalizeFolders(folders);
  if (scopedFolders.length === 0) {
    return true;
  }

  const normalizedPath = normalizeRepoPath(filePath);
  return scopedFolders.some(
    (folder) =>
      normalizedPath === folder || normalizedPath.startsWith(`${folder}/`)
  );
};

// Configuration object
const createConfig = (options = {}) => {
  const {
    config_file = "latest_translation_commit.json",
    working_directory = process.cwd(),
    filter_by_cloud_toc = false,
    folders = [],
    files = [],
  } = options;

  return {
    config_file,
    working_directory: path.resolve(working_directory),
    filter_by_cloud_toc,
    folders: normalizeFolders(folders),
    files,
  };
};

const getConfigPath = (config, relativePath) => {
  return path.join(config.working_directory, relativePath);
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const config = {
    config_file: "latest_translation_commit.json",
    working_directory: process.cwd(),
    filter_by_cloud_toc: false,
    folders: [],
    files: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--config" && i + 1 < args.length) {
      config.config_file = args[++i];
    } else if (arg === "--working-dir" && i + 1 < args.length) {
      config.working_directory = args[++i];
    } else if (arg === "--filter-by-cloud-toc") {
      config.filter_by_cloud_toc = true;
    } else if (
      (arg === "--folder" || arg === "--folders") &&
      i + 1 < args.length
    ) {
      const foldersArg = args[++i];
      config.folders = parseCommaSeparatedList(foldersArg);
    } else if (arg === "--files" && i + 1 < args.length) {
      const filesArg = args[++i];
      config.files = parseCommaSeparatedList(filesArg);
    }
  }

  return createConfig(config);
};

const octokit = GH_TOKEN
  ? new Octokit({
      auth: GH_TOKEN,
    })
  : new Octokit();

const getLocalCfg = (config) => {
  const configPath = getConfigPath(config, config.config_file);
  if (!fs.existsSync(configPath)) {
    console.log(`Config file not found: ${configPath}, using defaults`);
    return { target: "master", sha: "" };
  }
  const fileContent = fs.readFileSync(configPath);
  const data = JSON.parse(fileContent);
  return data;
};

const writeLocalCfg = (config, cfg) => {
  const configPath = getConfigPath(config, config.config_file);
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = JSON.stringify(cfg, null, 2);
  fs.writeFileSync(configPath, data);
};

const ghGetBranch = async (branchName = "master") => {
  const result = await octokit.request(
    `GET /repos/pingcap/docs/branches/${branchName}`,
    {
      owner: "pingcap",
      repo: "docs",
      branch: branchName,
    }
  );
  if (result.status === 200) {
    const data = result.data;
    return data;
  }
  throw new Error(`ghGetBranch error: ${result}`);
};

const ghCompareCommits = async (base = "", head = "") => {
  const basehead = `${base}...${head}`;
  const result = await octokit.request(
    `GET /repos/pingcap/docs/compare/${basehead}`,
    {
      owner: "pingcap",
      repo: "docs",
      basehead,
    }
  );
  if (result.status === 200) {
    const data = result.data;
    return data;
  }
  throw new Error(`ghGetBranch error: ${result}`);
};

const ghGetFileContent = async (filePath, branchName = "master") => {
  try {
    const result = await octokit.request(
      `GET /repos/pingcap/docs/contents/${filePath}`,
      {
        owner: "pingcap",
        repo: "docs",
        path: filePath,
        ref: branchName,
      }
    );

    if (result.status === 200) {
      return result.data;
    }
  } catch (error) {
    console.error(`Error fetching file ${filePath}:`, error.message);
    return null;
  }
  return null;
};

const downloadFile = async (url, targetPath) => {
  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
  });
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // pipe the result stream into a file on disc
  response.data.pipe(fs.createWriteStream(targetPath));
  // return a promise and resolve when download finishes
  return new Promise((resolve, reject) => {
    response.data.on("end", () => {
      resolve();
    });

    response.data.on("error", () => {
      reject();
    });
  });
};

const deleteFile = (targetFile) => {
  try {
    if (fs.existsSync(targetFile)) {
      fs.rmSync(targetFile);
    }
  } catch (error) {
    console.error(`Error deleting file ${targetFile}:`, error);
  }
};

const deleteFileInWorkingDir = (config, relativePath) => {
  const fullPath = getConfigPath(config, relativePath);
  deleteFile(fullPath);
};

// get the file list from the toc file
const getCloudTOCFiles = (config) => {
  // Generate tmp TOC paths from CLOUD_TOC_LIST
  const tmpTocFiles = getAllMdList(
    CLOUD_TOC_LIST.map((toc) => getConfigPath(config, `tmp/${toc}`))
  );

  // Generate regular TOC paths from CLOUD_TOC_LIST
  const cloudTocList = CLOUD_TOC_LIST.map((toc) => getConfigPath(config, toc));
  const tocFiles = getAllMdList(cloudTocList);

  // Convert to Set
  const tmpTocFilesSet = new Set(tmpTocFiles);
  const tocFilesSet = new Set(tocFiles);

  // Use tmpTocFiles if not empty, otherwise use tocFiles
  const finalTocFiles = tmpTocFilesSet.size > 0 ? tmpTocFilesSet : tocFilesSet;

  if (finalTocFiles.size === 0) {
    console.log(
      "Warning: No TOC file found or no files in TOC. All .md files will be processed."
    );
  }

  return finalTocFiles;
};

// filter the files in tmp directory by the toc file
const filterFilesByTOC = (config) => {
  console.log("Filtering files in tmp directory by TOC...");

  // get the file list from the toc file
  const tocFiles = getCloudTOCFiles(config);

  if (tocFiles.size === 0) {
    console.log("No TOC files found, keeping all files in tmp directory");
    return;
  }

  // get all .md files in the tmp directory
  const tmpDir = getConfigPath(config, "tmp");
  if (!fs.existsSync(tmpDir)) {
    console.log("tmp directory does not exist");
    return;
  }

  const getAllFiles = (dir) => {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath));
      } else if (item.endsWith(".md")) {
        files.push(fullPath);
      }
    }

    return files;
  };

  const tmpFiles = getAllFiles(tmpDir);
  let deletedCount = 0;
  let keptCount = 0;

  // Normalize TOC file paths by removing leading slashes
  const normalizedTocFiles = new Set(
    Array.from(tocFiles).map((file) => file.replace(/^\/+/, ""))
  );

  for (const filePath of tmpFiles) {
    // get the relative path to the tmp directory
    const relativePath = path.relative(tmpDir, filePath);

    // only check markdown files, non-markdown files are kept
    if (relativePath.endsWith(".md")) {
      // check if the markdown file is in the toc
      if (normalizedTocFiles.has(relativePath)) {
        console.log(`Keeping markdown file in TOC: ${relativePath}`);
        keptCount++;
      } else {
        console.log(`Deleting markdown file not in TOC: ${relativePath}`);
        deleteFile(filePath);
        deletedCount++;
      }
    } else {
      // non-markdown files are kept
      console.log(`Keeping non-markdown file: ${relativePath}`);
      keptCount++;
    }
  }

  console.log(
    `\nTOC Filter Summary: Kept ${keptCount} files, deleted ${deletedCount} files`
  );
};

const handleFiles = async (config, fileList = []) => {
  console.log(fileList);
  for (let file of fileList) {
    const { status, raw_url, filename, previous_filename } = file;

    const shouldProcessFile = (filePath) => {
      // md files are always processed
      if (filePath.endsWith(".md")) {
        return true;
      }

      // check if the file is in the whitelist
      return WHITELIST_FILENAMES.includes(path.basename(filePath));
    };

    switch (status) {
      case "added":
      case "modified":
        if (!shouldProcessFile(filename) || !isPathInFolders(filename, config.folders)) {
          break;
        }
        await downloadFile(raw_url, getConfigPath(config, `tmp/${filename}`));
        break;
      case "removed":
        if (!shouldProcessFile(filename) || !isPathInFolders(filename, config.folders)) {
          break;
        }
        deleteFileInWorkingDir(config, filename);
        break;
      case "renamed":
        if (
          previous_filename &&
          shouldProcessFile(previous_filename) &&
          isPathInFolders(previous_filename, config.folders)
        ) {
          deleteFileInWorkingDir(config, previous_filename);
        }
        if (
          shouldProcessFile(filename) &&
          isPathInFolders(filename, config.folders)
        ) {
          await downloadFile(raw_url, getConfigPath(config, `tmp/${filename}`));
        }
        break;
    }
  }
};

const handleSpecifiedFiles = async (config, fileList) => {
  // Get branch name from config file
  const { target: branchName } = getLocalCfg(config);
  console.log(`Processing ${fileList.length} files from branch: ${branchName}`);

  // filter files by extension and whitelist
  const filesToProcess = fileList.filter((filename) => {
    if (!isPathInFolders(filename, config.folders)) {
      return false;
    }
    // md files are always processed
    if (filename.endsWith(".md")) {
      return true;
    }

    // check if the file is in the whitelist
    return WHITELIST_FILENAMES.includes(path.basename(filename));
  });
  console.log(`Files to process: ${filesToProcess.length}`);
  console.log("Files:", filesToProcess);

  if (filesToProcess.length === 0) {
    console.log("No valid files to process");
    return;
  }

  // create tmp directory if it doesn't exist
  const tmpDir = getConfigPath(config, "tmp");
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // download all files
  for (let filename of filesToProcess) {
    console.log(`Processing file: ${filename}`);

    const fileData = await ghGetFileContent(filename, branchName);
    if (fileData && fileData.download_url) {
      await downloadFile(
        fileData.download_url,
        getConfigPath(config, `tmp/${filename}`)
      );
      console.log(`Downloaded: ${filename}`);
    } else {
      console.log(`Failed to download: ${filename}`);
    }
  }

  console.log(`Successfully processed ${filesToProcess.length} files`);

  // if it is cloud mode, filter the files by the toc
  if (config.filter_by_cloud_toc) {
    filterFilesByTOC(config);
  }

  // Ensure variables.json exists in tmp directory
  ensureVariablesJson(config);
};

const main = async (config) => {
  // If --files is provided, use specified files mode
  if (config.files && config.files.length > 0) {
    console.log("Using specified files mode");
    await handleSpecifiedFiles(config, config.files);
    return;
  }

  // Otherwise, use commit comparison mode
  console.log("Using commit comparison mode");
  const { target: branchName, sha: base } = getLocalCfg(config);
  const targetBranchData = await ghGetBranch(branchName);
  const head = targetBranchData?.commit?.sha;
  const comparedDetails = await ghCompareCommits(base, head);
  const files = comparedDetails?.files || [];

  // first handle all files
  await handleFiles(config, files);

  // if it is cloud mode, filter the files by the toc
  if (config.filter_by_cloud_toc) {
    filterFilesByTOC(config);
  }

  // Ensure variables.json exists in tmp directory
  ensureVariablesJson(config);

  writeLocalCfg(config, {
    target: branchName,
    sha: head,
  });
};

const config = parseArgs();
main(config);
