#!/usr/bin/env node

import { Command } from 'commander';
import OpenAI from 'openai';
import axios from 'axios'
import chalk from "chalk";
import figlet from "figlet";
import 'dotenv/config';

let GITHUB_TOKEN = process.env.GITHUB_TOKEN;
let GITHUB_OWNER = process.env.GITHUB_OWNER;
let OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const program = new Command();

let openai;

async function getPullRequestDiff(owner, repo, pullNumber) {
  console.log('GITHUB_TOKEN', GITHUB_TOKEN);
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/pulls/${pullNumber}`;
    console.log('url', url);
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: "application/vnd.github.v3.diff",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching PR diff:", error.message);
    return null;
  }
}

async function postPullRequestComment(owner, repo, pullNumber, comment) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${pullNumber}/comments`;
    const response = await axios.post(
      url,
      { body: comment },
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    console.log("Comment posted successfully:", response.data.html_url);
  } catch (error) {
    console.error("Error posting comment:", error.message);
  }
}

async function analyzeCode(diff) {
  const prompt = `
Berikut adalah perubahan kode dari Pull Request:

${diff}

1. Tolong buat ringkasan perubahan dalam bentuk tabel dengan kolom: File changes | Summary. Buat Summary dalam bentuk point-point dan file changes cukup nama file nya saja, tidak perlu full path.
2. Lakukan *code review* dan berikan feedback, termasuk saran perbaikan performa, keamanan, dan *best practices*, dengan menyebutkan lokasi file, nama function, potongan code yang dimaksud, dan sarannya (berikan juga highlight apa yang perlu diubah jika ada), dalam bahasa inggris.
`;

  try {
    const openAIOptions = {
      model: "gpt-4o-mini",
      // model: "o1-mini",
      messages: [
        { role: "system", content: "Anda adalah seorang Technical Lead dan reviewer kode yang berpengalaman." },
        { role: "user", content: prompt },
      ],
      // max_tokens: 10000,
      temperature: 0.2,
    };
    console.log('openAIOptions', openAIOptions.model);
    const response = await openai.chat.completions.create(openAIOptions);
    console.log('response', response);
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error during code analysis:", error.message);
    return null;
  }
}

async function commentCode(diff) {
  const prompt = `
Berikut adalah perubahan kode dari Pull Request:

${diff}

1. Tambahkan code comment, berupa js-doc atau javadoc, atau sejenis tergantung bahasa pemrograman yang dipakai, dalam bahasa inggris, untuk function yang ditemukan. abaikan jika tidak ada function yang ditemukan.
`;

  try {
    const openAIOptions = {
      model: "gpt-4o-mini",
      // model: "o1-mini",
      messages: [
        { role: "system", content: "Anda adalah seorang Technical Lead dan reviewer kode yang berpengalaman." },
        { role: "user", content: prompt },
      ],
      // max_tokens: 10000,
      temperature: 0.2,
    };
    console.log('openAIOptions', openAIOptions.model);
    const response = await openai.chat.completions.create(openAIOptions);
    console.log('response', response);
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error during code analysis:", error.message);
    return null;
  }
}

async function main(pullRequestId, repo) {
  console.log(`Fetching changes for PR #${pullRequestId}...`);
  const diff = await getPullRequestDiff(GITHUB_OWNER, repo, pullRequestId);

  if (!diff) {
    console.log("Failed to retrieve changes.");
    return;
  }

  console.log(`${green}Analyzing code changes...`);
  const analysis = await commentCode(diff);

  console.log(`\n${cyan}Analysis Result:\n`, analysis);
  await postPullRequestComment(GITHUB_OWNER, repo, pullRequestId, analysis);
}

program
  .requiredOption('--pull-request-id <number>', 'Pull request ID')
  .requiredOption('--repo <string>', 'Repository name (e.g., user/repo)')
  .option('--openai-api-key <string>', 'Open AI API key')
  .option('--github-owner <string>', 'Github owner')
  .option('--github-token <string>', 'Github token')
  .action(async (options) => {
    const { pullRequestId, repo, openaiApiKey, githubToken } = options;
    GITHUB_TOKEN = githubToken || process.env.GITHUB_TOKEN;
    OPENAI_API_KEY = openaiApiKey || process.env.OPENAI_API_KEY;
    GITHUB_OWNER = githubOwner || process.env.GITHUB_OWNER;

    openai = new OpenAI(
      { apiKey: OPENAI_API_KEY }
    );

    console.log(
      chalk.blue(
        figlet.textSync('pr-code-review', { horizontalLayout: 'full' })
      )
    );
    const version = require(path.resolve(__dirname, "../../package.json")).version;
    console.log(
      chalk.blue(
        figlet.textSync('v'+ version)
      )
    );

    console.log('options', options);

    await main(pullRequestId, repo);
  });

program.parse(process.argv)