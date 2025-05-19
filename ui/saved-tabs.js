// Saved Tabs Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
  const loadingDiv = document.getElementById('loading');
  const sessionsList = document.getElementById('sessions-list');
  const noSessionsDiv = document.getElementById('no-sessions');
  
  async function loadSessions() {
    try {
      // Get saved sessions from chrome storage
      const result = await chrome.storage.local.get('savedSessions');
      const sessions = result.savedSessions || [];
      
      loadingDiv.classList.add('hidden');
      
      if (sessions.length === 0) {
        noSessionsDiv.classList.remove('hidden');
        return;
      }
      
      sessionsList.classList.remove('hidden');
      sessionsList.innerHTML = '';
      
      // Sort sessions by date (newest first)
      sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      sessions.forEach((session, index) => {
        const sessionCard = createSessionCard(session, index);
        sessionsList.appendChild(sessionCard);
      });
      
    } catch (error) {
      console.error('Error loading sessions:', error);
      loadingDiv.textContent = 'Error loading sessions';
    }
  }
  
  function createSessionCard(session, index) {
    const card = document.createElement('div');
    card.className = 'session-card';
    
    const header = document.createElement('div');
    header.className = 'session-header';
    
    const titleDiv = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'session-title';
    title.textContent = session.name || `Session ${index + 1}`;
    
    const date = document.createElement('span');
    date.className = 'session-date';
    date.textContent = new Date(session.timestamp).toLocaleString();
    
    titleDiv.appendChild(title);
    titleDiv.appendChild(date);
    
    const actions = document.createElement('div');
    actions.className = 'session-actions';
    
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.onclick = () => exportSession(session);
    
    const openAllBtn = document.createElement('button');
    openAllBtn.textContent = 'Open All';
    openAllBtn.onclick = () => openAllTabs(session);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteSession(index);
    
    actions.appendChild(exportBtn);
    actions.appendChild(openAllBtn);
    actions.appendChild(deleteBtn);
    
    header.appendChild(titleDiv);
    header.appendChild(actions);
    
    const tabsList = document.createElement('div');
    tabsList.className = 'tabs-list';
    
    session.tabs.forEach(tab => {
      const tabItem = createTabItem(tab);
      tabsList.appendChild(tabItem);
    });
    
    card.appendChild(header);
    card.appendChild(tabsList);
    
    return card;
  }
  
  function createTabItem(tab) {
    const item = document.createElement('div');
    item.className = 'tab-item';
    
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title;
    
    const url = document.createElement('a');
    url.className = 'tab-url';
    url.href = tab.url;
    url.textContent = tab.url;
    url.target = '_blank';
    
    if (tab.summary) {
      const summary = document.createElement('div');
      summary.className = 'tab-summary';
      summary.textContent = tab.summary;
      item.appendChild(summary);
    }
    
    item.appendChild(title);
    item.appendChild(url);
    
    return item;
  }
  
  async function exportSession(session) {
    const content = JSON.stringify(session, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.timestamp}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
  
  async function openAllTabs(session) {
    const confirmOpen = confirm(`Open ${session.tabs.length} tabs?`);
    if (!confirmOpen) return;
    
    // Open tabs without awaiting to prevent blocking
    const promises = session.tabs.map(tab => chrome.tabs.create({ url: tab.url }));
    await Promise.all(promises);
  }
  
  async function deleteSession(index) {
    const confirmDelete = confirm('Delete this session?');
    if (!confirmDelete) return;
    
    try {
      const result = await chrome.storage.local.get('savedSessions');
      const sessions = result.savedSessions || [];
      sessions.splice(index, 1);
      await chrome.storage.local.set({ savedSessions: sessions });
      await loadSessions(); // Reload the list
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }
  
  // Initial load
  await loadSessions();
});