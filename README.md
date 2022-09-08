# site-downloader

a simple cli tool that used to download some simple single page web apps

# Install

```sh
cd site-downloader
npm install

node index.js --help
# or
npm link
site-downloader --help

# unlink the package
npm un -g site-downloader
```

# Usage

```sh
site-downloader -s https://vscode-shortcuts.com/ -o dist
# this will download the web page to ./dist/

site-downloader -s https://vscode-shortcuts.com/ -o dist -e
# this will download the web page as a single page, extracting required assets in it

site-downloader -s ./index.html -o ./single.html
# this will generate a single page of an HTML project
```
