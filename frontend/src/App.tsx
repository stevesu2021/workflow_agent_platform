import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import AgentList from './pages/AgentList';
import WorkflowStudio from './pages/WorkflowStudio';
import KnowledgeBase from './pages/KnowledgeBase';
import KnowledgeBaseDetail from './pages/KnowledgeBaseDetail';
import Settings from './pages/Settings';
import ToolManager from './pages/ToolManager';
import MCPManager from './pages/MCPManager';
import AgenticStudio from './pages/AgenticStudio';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="agents" element={<AgentList />} />
          <Route path="workflow" element={<WorkflowStudio />} />
          <Route path="workflow/:id" element={<WorkflowStudio />} />
          <Route path="agentic" element={<AgenticStudio />} />
          <Route path="agentic/:id" element={<AgenticStudio />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="knowledge/:id" element={<KnowledgeBaseDetail />} />
          <Route path="mcp" element={<MCPManager />} />
          <Route path="tools" element={<ToolManager />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
