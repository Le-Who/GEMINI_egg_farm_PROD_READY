#!/usr/bin/env node
/**
 * create-discord-activity-game — CLI Generator
 *
 * Usage:
 *   npx create-discord-activity-game my-game --genre farm --persistence memory
 *   npx create-discord-activity-game my-trivia --genre trivia --locale en,ru
 */

import { createProject } from "./generator.js";

interface CLIOptions {
  projectName: string;
  genre: string;
  persistence: string;
  locales: string[];
  theme: string;
}

function printHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     create-discord-activity-game                        ║
║     Discord Activities Game Generator                   ║
╚══════════════════════════════════════════════════════════╝

Usage:
  create-discord-activity-game <project-name> [options]

Options:
  --genre <genre>        Game genre: farm, card-battle, trivia, match-3
                         (default: farm)
  --persistence <type>   Storage backend: memory, local-file, gcs
                         (default: memory)
  --locale <locales>     Comma-separated locales (default: en)
  --theme <theme>        Color theme: dark, light, discord (default: discord)
  --help                 Show this help

Examples:
  create-discord-activity-game my-farm --genre farm
  create-discord-activity-game quiz-night --genre trivia --locale en,ru
  create-discord-activity-game card-game --genre card-battle --persistence local-file
  `);
}

function parseArgs(args: string[]): CLIOptions | null {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].replace("--", "");
      if (key === "help") {
        printHelp();
        process.exit(0);
      }
      flags[key] = args[++i] ?? "";
    } else {
      positional.push(args[i]);
    }
  }

  const projectName = positional[0];
  if (!projectName) {
    console.error("Error: Project name is required.\n");
    printHelp();
    return null;
  }

  // Validate genre
  const validGenres = ["farm", "card-battle", "trivia", "match-3"];
  const genre = flags.genre ?? "farm";
  if (!validGenres.includes(genre)) {
    console.error(
      `Error: Invalid genre "${genre}". Valid: ${validGenres.join(", ")}`,
    );
    return null;
  }

  return {
    projectName,
    genre,
    persistence: flags.persistence ?? "memory",
    locales: (flags.locale ?? "en").split(",").map((l) => l.trim()),
    theme: flags.theme ?? "discord",
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    printHelp();
    process.exit(0);
  }

  const options = parseArgs(args);
  if (!options) process.exit(1);

  console.log(`\n🎮 Creating Discord Activities game: ${options.projectName}`);
  console.log(`   Genre:       ${options.genre}`);
  console.log(`   Persistence: ${options.persistence}`);
  console.log(`   Locales:     ${options.locales.join(", ")}`);
  console.log(`   Theme:       ${options.theme}\n`);

  try {
    await createProject(options);
    console.log(`\n✅ Project created successfully!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   cd ${options.projectName}`);
    console.log(`   npm install`);
    console.log(`   npm run dev\n`);
  } catch (error) {
    console.error("❌ Error creating project:", error);
    process.exit(1);
  }
}

main();
