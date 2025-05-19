import React, { useState, useEffect } from 'react';
import { 
  Info, 
  Send, 
  Settings, 
  Save, 
  Eye, 
  Check, 
  ChevronDown,
  Loader2,
  Copy,
  X,
  Bot,
  Sparkles,
  Search
} from 'lucide-react';
import './globals.css';

// UI Components
import { Button } from './components/button';
import { Input } from './components/input';
import { Label } from './components/label';
import { Textarea } from './components/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/card';
import { RadioGroup, RadioGroupItem } from './components/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './components/accordion';
import { Checkbox } from './components/checkbox';
import { Alert, AlertDescription } from './components/alert';

function App() {
  // State
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [tabs, setTabs] = useState([]);
  const [showTabs, setShowTabs] = useState(false);
  const [status, setStatus] = useState({ message: '', type: 'info' });
  const [remainingRequests, setRemainingRequests] = useState(10);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState({
    apiKey: '',
    geminiApiKey: '',
    summaryMethod: 'chrome',
    rateLimit: 10,
    maxTabs: 10,
    enableSummaries: true,
    closeAfterSave: false
  });
  
  // Load settings on mount
  useEffect(() => {
    console.log('App initializing...');
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get([
        'apiKey',
        'geminiApiKey',
        'summaryMethod',
        'rateLimit',
        'maxTabs',
        'enableSummaries'
      ], (items) => {
        console.log('Settings loaded:', items);
        setSettings(prev => ({ ...prev, ...items }));
        setIsInitialized(true);
      });
      
      // Check rate limit
      checkRateLimit();
    } else {
      console.error('Chrome API not available');
      setIsInitialized(true);
    }
  }, []);
  
  const checkRateLimit = async () => {
    try {
      const result = await chrome.storage.local.get(['requestCount', 'lastResetTime']);
      const now = Date.now();
      const hourInMs = 60 * 60 * 1000;
      
      if (!result.lastResetTime || (now - result.lastResetTime) > hourInMs) {
        await chrome.storage.local.set({ requestCount: 0, lastResetTime: now });
        setRemainingRequests(settings.rateLimit);
      } else {
        const remaining = Math.max(0, settings.rateLimit - (result.requestCount || 0));
        setRemainingRequests(remaining);
      }
    } catch (error) {
      console.error('Error checking rate limit:', error);
    }
  };
  
  const handleSubmit = async () => {
    if (!query.trim() || !settings.apiKey) {
      setStatus({ message: 'Please enter a query and configure your API key', type: 'error' });
      return;
    }
    
    if (remainingRequests <= 0) {
      setStatus({ message: 'Rate limit exceeded. Please wait before trying again.', type: 'error' });
      return;
    }
    
    setIsLoading(true);
    setStatus({ message: 'Gathering tab information...', type: 'info' });
    
    try {
      // Get tabs
      const allTabs = await chrome.tabs.query({});
      const relevantTabs = allTabs
        .filter(tab => tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:')))
        .slice(0, settings.maxTabs)
        .map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title || tab.url,
          enableSummaries: settings.enableSummaries
        }));
      
      setTabs(relevantTabs);
      setStatus({ message: 'Processing query...', type: 'info' });
      
      // Send to background script
      const response = await chrome.runtime.sendMessage({
        action: 'processQuery',
        query: query,
        tabUrls: relevantTabs
      });
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      setResponse(response.result);
      if (response.processedTabs) {
        setTabs(response.processedTabs);
      }
      
      // Update rate limit
      const result = await chrome.storage.local.get(['requestCount']);
      await chrome.storage.local.set({ requestCount: (result.requestCount || 0) + 1 });
      setRemainingRequests(prev => Math.max(0, prev - 1));
      
      setStatus({ message: 'Query successful!', type: 'success' });
    } catch (error) {
      console.error('Error:', error);
      setStatus({ message: error.message || 'An error occurred', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveSettings = async () => {
    chrome.storage.sync.set(settings, () => {
      setStatus({ message: 'Settings saved successfully!', type: 'success' });
      setTimeout(() => setStatus({ message: '', type: 'info' }), 3000);
    });
  };
  
  const handleSaveTabs = async () => {
    setIsLoading(true);
    setStatus({ message: 'Saving tabs...', type: 'info' });
    
    try {
      const allTabs = await chrome.tabs.query({});
      const relevantTabs = allTabs.filter(tab => 
        tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:'))
      );
      
      const tabsWithSummaries = [];
      
      for (const tab of relevantTabs) {
        const tabData = {
          id: tab.id,
          url: tab.url,
          title: tab.title || tab.url,
          summary: null
        };
        
        if (settings.enableSummaries && settings.apiKey) {
          try {
            const response = await chrome.runtime.sendMessage({
              action: 'extractAndSummarize',
              tab: tab
            });
            
            if (response && response.summary) {
              tabData.summary = response.summary;
            }
          } catch (error) {
            console.error('Error getting summary:', error);
          }
        }
        
        tabsWithSummaries.push(tabData);
      }
      
      // Save session
      const session = {
        timestamp: Date.now(),
        name: `Session ${new Date().toLocaleString()}`,
        tabs: tabsWithSummaries
      };
      
      const result = await chrome.storage.local.get('savedSessions');
      const sessions = result.savedSessions || [];
      sessions.push(session);
      
      await chrome.storage.local.set({ savedSessions: sessions });
      
      // Close tabs if requested
      if (settings.closeAfterSave) {
        for (const tab of relevantTabs) {
          await chrome.tabs.remove(tab.id);
        }
      }
      
      setStatus({ message: 'Tabs saved successfully!', type: 'success' });
    } catch (error) {
      console.error('Error saving tabs:', error);
      setStatus({ message: error.message || 'Failed to save tabs', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewSaved = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('ui/saved-tabs.html') });
  };
  
  const handleCopyResponse = async () => {
    try {
      await navigator.clipboard.writeText(response);
      setStatus({ message: 'Response copied to clipboard!', type: 'success' });
      setTimeout(() => setStatus({ message: '', type: 'info' }), 2000);
    } catch (error) {
      setStatus({ message: 'Failed to copy response', type: 'error' });
    }
  };
  
  if (!isInitialized) {
    return (
      <div className="p-4 bg-background min-h-[600px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-background h-full flex flex-col">
      <h1 className="text-xl font-bold text-foreground mb-3">Query with Tab Context</h1>
      
      <div className="flex-1 overflow-y-auto">
        {/* Feature Info */}
        <Accordion type="single" collapsible className="mb-3">
          <AccordionItem value="info" className="border-b-0">
          <AccordionTrigger className="text-sm font-medium hover:no-underline py-2">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5" />
              How this works
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-1 pb-2">
              <p className="text-xs text-muted-foreground mb-2">
                This feature sends your query to Perplexity AI along with the titles, URLs, 
                and summaries of your open tabs as context. Perplexity will answer your 
                question based only on the information from these tabs, not from the broader internet.
              </p>
              <p className="text-xs font-medium mb-1">Example queries:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside ml-2">
                <li>"What are the main points across all these articles?"</li>
                <li>"Compare the different approaches mentioned in these tabs"</li>
                <li>"Summarize the key findings from these research papers"</li>
                <li>"What do these sources say about [specific topic]?"</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      {/* Query Section */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="space-y-3">
            <Textarea
              placeholder="Enter your query here..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
              disabled={isLoading}
            />
            <div className="flex items-center justify-between">
              <Button
                onClick={handleSubmit}
                disabled={!query.trim() || !settings.apiKey || isLoading || remainingRequests <= 0}
                size="sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-3.5 w-3.5" />
                    Send to Perplexity
                  </>
                )}
              </Button>
              <span className="text-sm text-muted-foreground">
                {remainingRequests} remaining
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Save Tabs Section */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">
              <Button onClick={handleSaveTabs} variant="secondary" size="sm" disabled={isLoading}>
                <Save className="mr-2 h-3.5 w-3.5" />
                Save Tabs
              </Button>
              <Button onClick={handleViewSaved} variant="outline" size="sm">
                <Eye className="mr-2 h-3.5 w-3.5" />
                View Saved
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="close-tabs"
                checked={settings.closeAfterSave}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, closeAfterSave: checked }))
                }
              />
              <Label htmlFor="close-tabs" className="text-sm cursor-pointer">
                Close tabs after saving
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Status Messages */}
      {status.message && (
        <Alert className={`mb-3 ${status.type === 'error' ? 'border-destructive' : ''}`}>
          <AlertDescription className="text-sm">{status.message}</AlertDescription>
        </Alert>
      )}
      
      {/* Response */}
      {response && (
        <Card className="mb-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Perplexity Response</CardTitle>
              <Button size="sm" variant="ghost" onClick={handleCopyResponse}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-snug">{response}</p>
          </CardContent>
        </Card>
      )}
      
      {/* Settings */}
      <Card className="mb-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Settings</CardTitle>
          <CardDescription className="text-xs">Configure your extension preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-4">
          {/* Summarization Method */}
          <div className="space-y-3 pb-3 border-b">
            <h3 className="text-base font-semibold">Summarization Method</h3>
            <RadioGroup
              value={settings.summaryMethod}
              onValueChange={(value) => setSettings(prev => ({ ...prev, summaryMethod: value }))}
            >
              <div className="grid grid-cols-3 gap-2">
                <Card
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    settings.summaryMethod === 'chrome' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSettings(prev => ({ ...prev, summaryMethod: 'chrome' }))}
                >
                  <CardContent className="p-3 text-center">
                    <div className="w-8 h-8 mx-auto mb-2 bg-primary/10 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-medium text-xs">Chrome AI</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">On-device (private)</p>
                    <RadioGroupItem value="chrome" className="sr-only" />
                  </CardContent>
                </Card>
                
                <Card
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    settings.summaryMethod === 'gemini' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSettings(prev => ({ ...prev, summaryMethod: 'gemini' }))}
                >
                  <CardContent className="p-3 text-center">
                    <div className="w-8 h-8 mx-auto mb-2 bg-primary/10 rounded-full flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-medium text-xs">Gemini Flash</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Fast AI</p>
                    <RadioGroupItem value="gemini" className="sr-only" />
                  </CardContent>
                </Card>
                
                <Card
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    settings.summaryMethod === 'perplexity' ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSettings(prev => ({ ...prev, summaryMethod: 'perplexity' }))}
                >
                  <CardContent className="p-3 text-center">
                    <div className="w-8 h-8 mx-auto mb-2 bg-primary/10 rounded-full flex items-center justify-center">
                      <Search className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-medium text-xs">Perplexity</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Search AI</p>
                    <RadioGroupItem value="perplexity" className="sr-only" />
                  </CardContent>
                </Card>
              </div>
            </RadioGroup>
          </div>
          
          {/* API Keys */}
          <div className="space-y-3 pb-3 border-b">
            <h3 className="text-base font-semibold">API Keys</h3>
            
            <div className="space-y-2 max-w-full">
              <Label htmlFor="api-key" className="text-xs font-medium">Perplexity API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="pplx-..."
                className="font-mono text-sm w-full"
              />
            </div>
            
            {settings.summaryMethod === 'gemini' && (
              <div className="space-y-2">
                <Label htmlFor="gemini-key" className="text-xs font-medium">Gemini API Key</Label>
                <Input
                  id="gemini-key"
                  type="password"
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                  placeholder="Enter your Gemini API key"
                  className="font-mono text-sm w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Get your key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
            )}
          </div>
          
          {/* Other Settings */}
          <div className="space-y-3 pb-3 border-b">
            <h3 className="text-base font-semibold">General Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="rate-limit" className="text-xs font-medium">Rate Limit (per hour)</Label>
                <Input
                  id="rate-limit"
                  type="number"
                  value={settings.rateLimit}
                  onChange={(e) => setSettings(prev => ({ ...prev, rateLimit: parseInt(e.target.value) }))}
                  min="1"
                  max="100"
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="max-tabs" className="text-xs font-medium">Maximum Tabs</Label>
                <Input
                  id="max-tabs"
                  type="number"
                  value={settings.maxTabs}
                  onChange={(e) => setSettings(prev => ({ ...prev, maxTabs: parseInt(e.target.value) }))}
                  min="1"
                  max="50"
                  className="w-full"
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-summaries"
              checked={settings.enableSummaries}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, enableSummaries: checked }))
              }
            />
            <Label htmlFor="enable-summaries" className="text-sm">Enable tab summaries</Label>
          </div>
          
          <Button onClick={handleSaveSettings} size="sm" className="w-full sm:w-auto">
            <Check className="mr-2 h-3.5 w-3.5" />
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
      
      {/* Footer */}
      <div className="py-4 border-t mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTabs(!showTabs)}
          className="w-full text-sm"
        >
          {showTabs ? 'Hide' : 'Show'} Used Tabs ({tabs.length})
        </Button>
        
        {/* Tabs List */}
        {showTabs && tabs.length > 0 && (
          <Card className="mt-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Using these tabs ({tabs.length})</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {tabs.map((tab, index) => (
                  <div key={index} className="p-3 bg-muted/30 rounded-md space-y-1 border border-muted/50 hover:bg-muted/50 transition-colors">
                    <h5 className="font-medium text-xs line-clamp-1">{index + 1}. {tab.title}</h5>
                    <p className="text-[10px] text-muted-foreground truncate">{tab.url}</p>
                    {tab.summary && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                        <span className="font-medium">Summary:</span> {tab.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;