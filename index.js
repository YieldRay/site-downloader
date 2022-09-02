#!/usr/bin/env node
const fs = require("fs/promises");
const { readFileSync, writeFileSync } = require("fs");
const path = require("path");
const { Command } = require("commander");
const cheerio = require("cheerio");
const fetch = require("node-fetch");
const download = require("dler");
const pkg = require("./package.json");
const program = new Command();

program.name(pkg.name).description(pkg.description).version(pkg.version);
program.requiredOption("-s, --site <url>", "website to download");
program.option("-o, --out <path>", "a folder that downloaded file save to", "./");
program.option("-e, --extract", "extract to a single file");
program.parse();

const options = program.opts();
const outDir = path.normalize(options.out + "/"); // must ends with '/'
const isNeedToDL = (u) => u && !(new RegExp("^https?://").test(u) || u.startsWith("//"));
if (!isNeedToDL(options.site)) downloadRemoteSite(options.site, outDir, options.extract);
else extractLocalHTMLProject(options.site, options.out);
/* END */

/* 
R
E
M
O
T
E
*/
async function downloadRemoteSite(targetSite, outDir, isSingle) {
    const url = new URL(options.site);
    const parseToRemote = (p) => url.origin + path.normalize(path.posix.resolve(url.pathname, p));
    const parseToLocal = (p) => path.dirname(path.normalize(outDir + path.posix.resolve(url.pathname, p))) + "/";
    const downloadToLocal = (u) => download(parseToRemote(u), { filePath: parseToLocal(u) });
    const fetchText = (p) => fetch(parseToRemote(p)).then((res) => res.text());
    const fetchAsDataURL = async (p) => {
        const res = await fetch(parseToRemote(p));
        const mime = res.headers.get("content-type");
        const buffer = await res.buffer();
        return `data:${mime};base64,${buffer.toString("base64")}`;
    };
    const computeRelativePath = (saved) =>
        path.relative(path.resolve(outDir), saved).split(path.sep).join(path.posix.sep);
    // prepare utils end
    const indexoutPathOrDir = path.normalize(url.pathname === "/" ? outDir + "index.html" : outDir);
    const indexSavedPath = await download(targetSite, { filePath: indexoutPathOrDir });
    const indexContent = await fs.readFile(indexSavedPath, "utf-8");
    const $ = cheerio.load(indexContent);
    // load index end
    const elems = { script: [], link: [], img: [] };
    $("script").each(function () {
        elems.script.push($(this));
    });
    $("link").each(function () {
        elems.link.push($(this));
    });
    $("img").each(function () {
        elems.img.push($(this));
    });
    // pre-load elements
    for (const e of elems.script) {
        const src = e.attr("src");
        if (!isNeedToDL(src)) continue;
        if (isSingle) {
            const srcContent = await fetchText(src);
            e.removeAttr("src");
            e.html(srcContent);
        } else {
            const saved = await downloadToLocal(src);
            e.attr("src", computeRelativePath(saved));
            console.log(`${src} -> ${saved}`);
        }
    }

    for (const e of elems.link) {
        const href = e.attr("href");
        if (!isNeedToDL(href)) continue;
        // if (e.attr("rel") !== "stylesheet") continue;

        if (isSingle) {
            if (e.attr("rel") !== "stylesheet") continue;
            const hrefContent = await fetchText(href);
            e.after(`<style>${hrefContent}</style>`);
            e.remove();
        } else {
            const saved = await downloadToLocal(href);
            e.attr("href", computeRelativePath(saved));
            console.log(`${href} -> ${saved}`);
        }
    }

    for (const e of elems.img) {
        const src = e.attr("src");
        if (!isNeedToDL(src)) continue;
        if (isSingle) {
            const dataURL = await fetchAsDataURL(src);
            e.attr("src", dataURL);
        } else {
            const saved = await downloadToLocal(src);
            e.attr("src", computeRelativePath(saved));
            console.log(`${src} -> ${saved}`);
        }
    }

    // await new Promise((r) => setTimeout(() => r(), 5000));
    await fs.writeFile(indexSavedPath, $.html(), "utf-8");
    process.exit();
}
/* 
L
O
C
A
L
*/
function extractLocalHTMLProject(inPath, outPath) {
    if (!inPath || !outPath) process.exit("Please specify in-path and out-path!");
    const computeRelativePath = (saved) => path.normalize(path.dirname(inPath) + saved);
    const $ = cheerio.load(readFileSync(inPath, "utf8"));
    $("script").each(function () {
        const e = $(this);
        const src = e.attr("src");
        if (!isNeedToDL(src)) return;
        const srcContent = readFileSync(computeRelativePath(src));
        e.html(srcContent);
        e.removeAttr("src");
    });
    $("link").each(function () {
        const e = $(this);
        const href = e.attr("href");
        if (!isNeedToDL(href)) return;
        if (e.attr("rel") === "stylesheet") {
            const hrefContent = readFileSync(computeRelativePath(href));
            e.after(`<style>${hrefContent}</style>`);
            e.remove();
        }
    });
    writeFileSync(outPath, $.html(), { encoding: "utf8" });
    process.exit();
}
