import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  ExternalLink, 
  Download, 
  FolderOpen
} from 'lucide-react';
import './globals.css';

// UI Components
import { Button } from './components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/card';
import { Alert, AlertDescription } from './components/alert';

function SavedTabs() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  
  useEffect(() => {
    loadSessions();
  }, []);
  
  const loadSessions = async () => {
    try {
      const result = await chrome.storage.local.get('savedSessions');
      const savedSessions = result.savedSessions || [];
      setSessions(savedSessions.reverse()); // Show newest first
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };
  
  const deleteSession = async (index) => {
    const sessionToDelete = sessions[index];
    const updatedSessions = sessions.filter((_, i) => i !== index);
    
    try {
      await chrome.storage.local.set({ savedSessions: updatedSessions.reverse() });
      setSessions(updatedSessions.reverse());
      
      if (selectedSession === sessionToDelete) {
        setSelectedSession(null);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };
  
  const openAllTabs = (session) => {
    session.tabs.forEach(tab => {
      chrome.tabs.create({ url: tab.url });
    });
  };
  
  const exportSession = (session) => {
    const exportData = {
      name: session.name,
      timestamp: session.timestamp,
      tabs: session.tabs.map(tab => ({
        title: tab.title,
        url: tab.url,
        summary: tab.summary
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${new Date(session.timestamp).toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-primary mb-6">Saved Tab Sessions</h1>
        
        {sessions.length === 0 ? (
          <Alert>
            <AlertDescription>No saved sessions found.</AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sessions List */}
            <div className="space-y-3">
              {sessions.map((session, index) => (
                <Card 
                  key={index}
                  className={`cursor-pointer transition-all ${
                    selectedSession === session ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedSession(session)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        {new Date(session.timestamp).toLocaleString()}
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(index);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>{session.tabs.length} tabs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAllTabs(session);
                        }}
                      >
                        <FolderOpen className="mr-1 h-3 w-3" />
                        Open All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportSession(session);
                        }}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Export
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Session Details */}
            {selectedSession && (
              <Card>
                <CardHeader>
                  <CardTitle>Session Details</CardTitle>
                  <CardDescription>
                    {new Date(selectedSession.timestamp).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {selectedSession.tabs.map((tab, index) => (
                      <div 
                        key={index}
                        className="p-3 bg-muted rounded-lg space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-medium text-sm flex-1 pr-2">
                            {tab.title}
                          </h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => chrome.tabs.create({ url: tab.url })}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {tab.url}
                        </p>
                        {tab.summary && (
                          <p className="text-sm italic text-muted-foreground">
                            {tab.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SavedTabs;