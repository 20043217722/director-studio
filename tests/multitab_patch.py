# -*- coding: utf-8 -*-
"""Patch App.jsx for multi-tab agent sessions."""
import re, sys

path = 'D:/导演工作室/src/App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. Add import
old = 'import MobileTabBar from "./components/MobileTabBar";'
new = 'import MobileTabBar from "./components/MobileTabBar";\nimport { loadSessionHistory, saveSessionHistory } from "./lib/sessionStore";'
if old in content:
    content = content.replace(old, new)
    changes += 1

# 2. Replace state declarations
old = '''  const [mode, setMode] = useState(() => localStorage.getItem("director_studio_last_mode") || "director");
  const [messages, setMessages] = useState(() => loadHistory(mode));
  const [loading, setLoading] = useState(false);'''
new = '''  const [mode, setMode] = useState(() => localStorage.getItem("director_studio_last_mode") || "director");
  const [messages, setMessages] = useState(() => loadSessionHistory(mode));
  const [loading, setLoading] = useState(false);
  const sessionsRef = useRef({});
  const [activeTabs, setActiveTabs] = useState(() => [localStorage.getItem("director_studio_last_mode") || "director"]);'''
if old in content:
    content = content.replace(old, new)
    changes += 1
    print("OK: state replaced")
else:
    print("FAIL: state not found")

# 3. Replace switchMode
old = '''  function switchMode(newMode) {
    if (newMode === mode) return;
    if (loading && !window.confirm("当前智能体正在回复中，切换将丢失回复内容。确定切换吗？")) return;
    // 停止当前生成
    if (abortRef.current) abortRef.current.abort();
    saveHistory(mode, messages);
    setMessages(loadHistory(newMode));
    setMode(newMode);
    setLoading(false);
    abortRef.current = null;
    sendingRef.current = false;
  }'''
new = '''  function switchMode(newMode) {
    const cur = sessionsRef.current[mode] || {};
    sessionsRef.current[mode] = { ...cur, messages, loading, sendingRef: sendingRef.current };
    saveSessionHistory(mode, messages);
    if (newMode === mode) return;
    const saved = sessionsRef.current[newMode];
    setMessages(saved?.messages || loadSessionHistory(newMode));
    setMode(newMode);
    setLoading(saved?.loading || false);
    sendingRef.current = saved?.sendingRef || false;
    setActiveTabs(prev => prev.includes(newMode) ? prev : [...prev, newMode]);
  }

  function closeTab(tabMode) {
    const tabs = activeTabs.filter(t => t !== tabMode);
    if (tabs.length === 0) return;
    if (tabMode === mode) {
      const nextMode = tabs[0];
      const saved = sessionsRef.current[nextMode];
      saveSessionHistory(mode, messages);
      setMessages(saved?.messages || loadSessionHistory(nextMode));
      setMode(nextMode);
      setLoading(saved?.loading || false);
      sendingRef.current = saved?.sendingRef || false;
    }
    setActiveTabs(tabs);
  }'''
if old in content:
    content = content.replace(old, new)
    changes += 1
    print("OK: switchMode replaced")
else:
    print("FAIL: switchMode not found")

# 4. Replace saveHistory/loadHistory calls
if 'saveHistory(mode, messages)' in content:
    content = content.replace('saveHistory(mode, messages)', 'saveSessionHistory(mode, messages)')
    changes += 1
if 'loadHistory(mode)' in content:
    content = content.replace('loadHistory(mode)', 'loadSessionHistory(mode)')
    changes += 1
if 'loadHistory(newMode)' in content:
    content = content.replace('loadHistory(newMode)', 'loadSessionHistory(newMode)')
    changes += 1

# 5. Add tab bar
old = '<div className="flex-1 overflow-hidden flex flex-col relative">'
tab = '<div className="flex-1 overflow-hidden flex flex-col relative">\n'
tab += '        {/* Agent tabs */}\n'
tab += '        <div style={{display:"flex",gap:2,padding:"2px 6px",overflowX:"auto",background:"var(--bg-root)",borderBottom:"1px solid var(--border)",minHeight:30,alignItems:"flex-end"}}>\n'
tab += '          {activeTabs.map(t => {\n'
tab += '            const ag = AGENTS.find(a => a.id === t);\n'
tab += '            const isActive = mode === t;\n'
tab += '            return (\n'
tab += '              <button key={t} onClick={() => switchMode(t)}\n'
tab += '                style={{\n'
tab += '                  padding:"3px 8px",fontSize:11,fontWeight:isActive?700:500,\n'
tab += '                  borderRadius:"4px 4px 0 0",border:"none",cursor:"pointer",\n'
tab += '                  background:isActive?"var(--bg-card)":"transparent",\n'
tab += '                  color:isActive?"var(--text)":"var(--text-muted)",\n'
tab += '                  whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:3,\n'
tab += '                  borderBottom:isActive?"2px solid var(--accent)":"2px solid transparent",\n'
tab += '                }}>\n'
tab += '                {ag?.name||t}\n'
tab += '                {activeTabs.length>1 && <span onClick={(e)=>{e.stopPropagation();closeTab(t)}} style={{fontSize:9,opacity:.4}}>x</span>}\n'
tab += '              </button>\n'
tab += '            );\n'
tab += '          }})}\n'
tab += '          <span style={{fontSize:9,color:"var(--text-muted)",padding:"3px 6px",flex:1,textAlign:"right"}}>点击Agent加标签 | 各标签独立并行</span>\n'
tab += '        </div>\n'
if old in content:
    content = content.replace(old, tab)
    changes += 1
    print("OK: tab bar added")
else:
    print("FAIL: chat area not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Changes:", changes)
