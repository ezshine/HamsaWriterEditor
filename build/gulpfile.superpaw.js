/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const task = require('./lib/task');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const mkdirp = require('mkdirp');
const util = require('util');
const stream = require('stream');
const pipeline = util.promisify(stream.pipeline);

/**
 * Downloads the latest version of SuperPaw extension and extracts it to the extensions directory
 */
const downloadSuperPawTask = task.define('download-superpaw', async () => {
	console.log('Downloading latest SuperPaw extension...');

	try {
		// Fetch the marketplace page to get the latest version
		// Use the marketplace API to get the latest version
		const response = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
			method: 'POST',
			headers: {
				'User-Agent': 'Apipost client Runtime/+https://www.apipost.cn/',
				'accept': 'application/json;api-version=7.2-preview.1;excludeUrls=true',
				'accept-language': 'zh-CN,zh;q=0.9',
				'cache-control': 'no-cache',
				'content-type': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ 'assetTypes': null, 'filters': [{ 'criteria': [{ 'filterType': 7, 'value': 'ezshine.superpaw' }], 'direction': 2, 'pageSize': 100, 'pageNumber': 1, 'sortBy': 0, 'sortOrder': 0, 'pagingToken': null }], 'flags': 2151 })
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch extension information: ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.results || !data.results[0] || !data.results[0].extensions || !data.results[0].extensions[0]) {
			throw new Error('Could not find SuperPaw extension information in the API response');
		}

		const extension = data.results[0].extensions[0];
		const latestVersion = extension.versions[0].version;
		console.log(`Latest SuperPaw version: ${latestVersion}`);

		// Construct the download URL
		const downloadUrl = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ezshine/vsextensions/superpaw/${latestVersion}/vspackage`;

		// Create extensions directory if it doesn't exist
		const extensionsDir = path.join(__dirname, '..', 'extensions');
		const superPawDir = path.join(extensionsDir, 'superpaw');
		const downloadPath = path.join(extensionsDir, 'superpaw.zip');

		if (!fs.existsSync(extensionsDir)) {
			fs.mkdirSync(extensionsDir, { recursive: true });
		}

		// Download the extension
		console.log(`Downloading from: ${downloadUrl}`);
		const downloadResponse = await fetch(downloadUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
				'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
				'accept-language': 'zh-CN,zh;q=0.9',
				'cache-control': 'no-cache',
				'sec-fetch-dest': 'document',
				'sec-fetch-mode': 'navigate',
				'sec-fetch-site': 'none',
				'upgrade-insecure-requests': '1'
			}
		});

		if (!downloadResponse.ok) {
			throw new Error(`Failed to download SuperPaw extension: ${downloadResponse.statusText}`);
		}

		// Save the downloaded file
		const fileStream = fs.createWriteStream(downloadPath);
		await pipeline(downloadResponse.body, fileStream);
		console.log(`Downloaded to: ${downloadPath}`);

		// Extract the zip file
		console.log('Extracting SuperPaw extension...');

		// Remove existing directory if it exists
		if (fs.existsSync(superPawDir)) {
			fs.rmSync(superPawDir, { recursive: true, force: true });
		}

		// Create the directory
		fs.mkdirSync(superPawDir, { recursive: true });

		// Extract the zip file
		await new Promise((resolve, reject) => {
			yauzl.open(downloadPath, { lazyEntries: true }, (err, zipfile) => {
				if (err) {
					reject(err);
					return;
				}

				zipfile.on('entry', (entry) => {
					// Check if the entry is within the 'extension' directory
					if (entry.fileName.startsWith('extension/')) {
						// Remove 'extension/' prefix to place files directly in superPawDir
						const relativePath = entry.fileName.substring('extension/'.length);
						const entryPath = path.join(superPawDir, relativePath);

						if (/\/$/.test(entry.fileName)) {
							// Directory entry
							mkdirp.sync(entryPath);
							zipfile.readEntry();
						} else {
							// File entry
							mkdirp.sync(path.dirname(entryPath));
							zipfile.openReadStream(entry, (err, readStream) => {
								if (err) {
									reject(err);
									return;
								}

								const writeStream = fs.createWriteStream(entryPath);
								readStream.pipe(writeStream);

								writeStream.on('finish', () => {
									zipfile.readEntry();
								});
							});
						}
					} else {
						// Skip entries not in the extension directory
						zipfile.readEntry();
					}
				});

				zipfile.on('end', () => {
					resolve();
				});

				zipfile.on('error', (err) => {
					reject(err);
				});

				zipfile.readEntry();
			});
		});

		// Clean up the zip file
		fs.unlinkSync(downloadPath);

		console.log('SuperPaw extension successfully downloaded and extracted!');
	} catch (error) {
		console.error('Error downloading SuperPaw extension:', error);
		throw error;
	}
});

module.exports = {
	downloadSuperPawTask,
};
