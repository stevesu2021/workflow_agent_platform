import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import AgentList from './pages/AgentList';
import WorkflowStudio from './pages/WorkflowStudio';
import KnowledgeBase from './pages/KnowledgeBase';
import KnowledgeBaseDetail from './pages/KnowledgeBaseDetail';
import Settings from './pages/Settings';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="agents" element={<AgentList />} />
          <Route path="studio" element={<WorkflowStudio />} />
          <Route path="studio/:id" element={<WorkflowStudio />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="knowledge/:id" element={<KnowledgeBaseDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
