/**
 * Generator — Template copy engine with variable substitution.
 *
 * Copies a genre template directory to the target location,
 * replacing template variables (e.g., {{GAME_ID}}, {{GAME_TITLE}}).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");

interface ProjectOptions {
  projectName: string;
  genre: string;
  persistence: string;
  locales: string[];
  theme: string;
}

/** Variable map for template substitution */
function buildVariables(options: ProjectOptions): Record<string, string> {
  const gameId = options.projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
  const gameTitle = options.projectName
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    "{{GAME_ID}}": gameId,
    "{{GAME_TITLE}}": gameTitle,
    "{{GAME_GENRE}}": options.genre,
    "{{PERSISTENCE}}": options.persistence,
    "{{LOCALES}}": JSON.stringify(options.locales),
    "{{DEFAULT_LOCALE}}": options.locales[0] ?? "en",
    "{{THEME}}": options.theme,
    "{{VERSION}}": "0.1.0",
  };
}

/** Recursively copy a directory, applying variable substitution to text files */
function copyDir(
  src: string,
  dest: string,
  variables: Record<string, string>,
): void {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    let destName = entry.name;

    // Rename .tmpl files
    if (destName.endsWith(".tmpl")) {
      destName = destName.replace(".tmpl", "");
    }

    const destPath = path.join(dest, destName);

    if (entry.isDirectory()) {
      // Skip node_modules, dist
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      copyDir(srcPath, destPath, variables);
    } else {
      copyFile(srcPath, destPath, variables);
    }
  }
}

/** Copy a single file with template variable substitution */
function copyFile(
  src: string,
  dest: string,
  variables: Record<string, string>,
): void {
  const ext = path.extname(src).toLowerCase();
  const textExtensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".html",
    ".css",
    ".yml",
    ".yaml",
    ".toml",
    ".env",
    ".tmpl",
    "",
  ];

  if (textExtensions.includes(ext)) {
    let content = fs.readFileSync(src, "utf-8");
    for (const [key, value] of Object.entries(variables)) {
      content = content.replaceAll(key, value);
    }
    fs.writeFileSync(dest, content);
  } else {
    // Binary files: straight copy
    fs.copyFileSync(src, dest);
  }
}

/** Create a new project from a genre template */
export async function createProject(options: ProjectOptions): Promise<void> {
  const templateDir = path.join(TEMPLATES_DIR, options.genre);

  if (!fs.existsSync(templateDir)) {
    throw new Error(
      `Template not found: ${options.genre}. Available: ${getAvailableGenres().join(", ")}`,
    );
  }

  const targetDir = path.resolve(process.cwd(), options.projectName);

  if (fs.existsSync(targetDir)) {
    throw new Error(`Directory already exists: ${targetDir}`);
  }

  console.log(`   Template: ${templateDir}`);
  console.log(`   Target:   ${targetDir}`);

  const variables = buildVariables(options);
  copyDir(templateDir, targetDir, variables);

  // Create .env file
  const envContent = `# Discord Application Credentials
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_REDIRECT_URI=http://localhost:8080

# Server
PORT=8080
ADMIN_PASSWORD=admin123

# Persistence: memory | local-file | gcs
GAME_PERSISTENCE=${options.persistence}
`;
  fs.writeFileSync(path.join(targetDir, ".env"), envContent);

  // Create .gitignore
  const gitignore = `node_modules/
dist/
.env
*.log
data/db.json
`;
  fs.writeFileSync(path.join(targetDir, ".gitignore"), gitignore);

  console.log("   ✓ Template copied");
  console.log("   ✓ .env created");
  console.log("   ✓ .gitignore created");
}

/** List available genre templates */
export function getAvailableGenres(): string[] {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
