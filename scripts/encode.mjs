import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const dir = join(import.meta.dirname || ".", "public");

// Read PNG icon
const iconBytes = readFileSync(join(dir, "icon-180.png"));
const iconB64 = iconBytes.toString("base64");

// Mobileconfig XML with proper UTF-8
const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>FullScreen</key>
			<true/>
			<key>Icon</key>
			<data>${iconB64}</data>
			<key>IsRemovable</key>
			<true/>
			<key>Label</key>
			<string>导演工作室</string>
			<key>PayloadDescription</key>
			<string>AI 电影导演创作工具</string>
			<key>PayloadDisplayName</key>
			<string>导演工作室</string>
			<key>PayloadIdentifier</key>
			<string>com.director.studio.webclip</string>
			<key>PayloadType</key>
			<string>com.apple.webClip.managed</string>
			<key>PayloadUUID</key>
			<string>B2C3D4E5-F6A7-8901-BCDE-F12345678901</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>Precomposed</key>
			<true/>
			<key>URL</key>
			<string>https://director-studio.surge.sh</string>
		</dict>
	</array>
	<key>PayloadDescription</key>
	<string>安装导演工作室到主屏幕</string>
	<key>PayloadDisplayName</key>
	<string>导演工作室</string>
	<key>PayloadIdentifier</key>
	<string>com.director.studio.profile</string>
	<key>PayloadRemovalDisallowed</key>
	<false/>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>`;

// Save mobileconfig
writeFileSync(join(dir, "director-studio.mobileconfig"), mobileconfig, "utf-8");

// Encode for data URI
const mcBytes = Buffer.from(mobileconfig, "utf-8");
const mcB64 = mcBytes.toString("base64");
const dataUri = `data:application/x-apple-aspen-config;base64,${mcB64}`;

// Generate install.html
let html = readFileSync(join(dir, "install-template.html"), "utf-8");
html = html.replace("DATA_URI_PLACEHOLDER", dataUri);
writeFileSync(join(dir, "install.html"), html, "utf-8");

console.log("Done: icon embedded, install.html generated (UTF-8 OK)");
