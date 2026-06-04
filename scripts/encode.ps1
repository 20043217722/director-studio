# Encode icon + mobileconfig for iOS install page
[Console]::OutputEncoding = [Text.Encoding]::UTF8

# Read and encode PNG icon
$iconBytes = [IO.File]::ReadAllBytes("$PSScriptRoot\public\icon-180.png")
$iconB64 = [Convert]::ToBase64String($iconBytes)

# Build mobileconfig with icon embedded
$mobileconfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>FullScreen</key>
			<true/>
			<key>Icon</key>
			<data>$iconB64</data>
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
</plist>
"@

# Save mobileconfig
[IO.File]::WriteAllText("$PSScriptRoot\public\director-studio.mobileconfig", $mobileconfig, [Text.Encoding]::UTF8)

# Base64 encode mobileconfig for data URI
$xmlBytes = [Text.Encoding]::UTF8.GetBytes($mobileconfig)
$xmlB64 = [Convert]::ToBase64String($xmlBytes)
$dataUri = "data:application/x-apple-aspen-config;base64,$xmlB64"

# Generate install.html from template
$template = Get-Content "$PSScriptRoot\public\install-template.html" -Raw -Encoding UTF8
$html = $template -replace 'DATA_URI_PLACEHOLDER', $dataUri
[IO.File]::WriteAllText("$PSScriptRoot\public\install.html", $html, [Text.Encoding]::UTF8)

Write-Output "Done: icon embedded, install.html generated"
