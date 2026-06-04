const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "导演工作室",
    icon: path.join(__dirname, "../public/icon-512.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("https://localhost:5174");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// 文件保存对话框
ipcMain.handle("save-file", async (_, { title, buffer, ext }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "导出文件",
    defaultPath: `${title || "导出"}.${ext}`,
    filters: [
      ext === "docx" ? { name: "Word文档", extensions: ["docx"] } : { name: "PPT幻灯片", extensions: ["pptx"] },
    ],
  });
  if (!canceled && filePath) {
    require("fs").writeFileSync(filePath, Buffer.from(Array.isArray(buffer) ? buffer : buffer));
    return filePath;
  }
  return null;
});
