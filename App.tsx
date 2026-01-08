
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, 
  ShieldCheck, 
  BarChart3, 
  FileText, 
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  ArrowRight,
  History,
  Paperclip,
  CheckSquare,
  Users,
  LayoutDashboard,
  FileDown,
  Info,
  Database,
  XCircle,
  GanttChart,
  Lock,
  Unlock,
  GitBranch,
  Save,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  X,
  BookOpen,
  Target,
  Lightbulb,
  PlayCircle
} from 'lucide-react';
import { 
  WBSItem, 
  Requirement, 
  WorkPerformanceData, 
  Deliverable, 
  ChangeRequest, 
  ScopeAnalysisResult,
  ValidationResult,
  InspectionItem,
  AuditLogEntry,
  Evidence,
  LessonsLearned,
  ScopeReport,
  ProjectScopeStatement
} from './types';
import { 
  analyzeScopeControl, 
  validateDeliverableWithEvidence, 
  generateInspectionChecklist,
  generateScopeReport,
  generateLessonsLearned,
  decomposeScopeToWBS
} from './services/geminiService';

const demoData = {
  scopeStatement: {
    description: "Develop a secure, AI-powered cloud-based customer portal for financial services.",
    deliverables: ["User Dashboard", "Secure API", "Database Layer", "Admin Panel"],
    exclusions: ["Mobile Application", "Third-party Payment Integration"],
    assumptions: ["Cloud infrastructure available", "API keys provided by bank"],
    constraints: ["Budget limited to $50k", "Completion by Q4"]
  },
  reqs: [
    { id: 'r1', title: 'User Login with MFA', category: 'Functional', priority: 'High', source: 'Sponsor' },
    { id: 'r2', title: 'Data Encryption at Rest', category: 'Non-Functional', priority: 'High', source: 'Security Team' },
    { id: 'r3', title: 'Admin Analytics View', category: 'Functional', priority: 'Medium', source: 'Product Manager' }
  ],
  performance: [
    { id: 'p1', wbsId: 'wp-1', actualWorkDescription: 'Completed MFA auth logic', progressPercentage: 100, timestamp: new Date().toISOString() }
  ]
};

const walkthroughProject = {
  scope: {
    description: "Create a Student Attendance Mobile App for tracking class presence using QR codes.",
    deliverables: ["QR Scanner Component", "Cloud Database Integration", "Student/Teacher Dashboard"],
    exclusions: ["Bio-metric scanning", "Offline database sync"],
    assumptions: ["Students have smartphones", "School WiFi is stable"],
    constraints: ["Must launch before Fall semester", "GDPR compliant"]
  },
  reqs: [
    { id: 'w-r1', title: 'QR Code Generation for Teachers', category: 'Functional', priority: 'High', source: 'Dean' },
    { id: 'w-r2', title: 'Real-time Attendance Logging', category: 'Functional', priority: 'High', source: 'Registrar' },
    { id: 'w-r3', title: 'CSV Report Export', category: 'Business', priority: 'Medium', source: 'Admin Office' },
    { id: 'w-r4', title: 'Sub-second QR recognition', category: 'Non-Functional', priority: 'High', source: 'UX Team' },
    { id: 'w-r5', title: 'Push notifications for late arrivals', category: 'Functional', priority: 'Low', source: 'Students' }
  ],
  wbs: [
    { id: 'w-1', parentId: null, code: '1.0', name: 'QR Logic', description: 'Core scanning functionality', acceptanceCriteria: 'Scans in < 1sec', isWorkPackage: false, isApproved: true },
    { id: 'w-1-1', parentId: 'w-1', code: '1.1', name: 'Scanner UI', description: 'Camera interface for scanning', acceptanceCriteria: 'Visible scan frame', isWorkPackage: true, isApproved: true },
    { id: 'w-2', parentId: null, code: '2.0', name: 'Data Management', description: 'Backend and storage', acceptanceCriteria: 'Data saved to cloud', isWorkPackage: true, isApproved: true }
  ],
  performance: [
    { id: 'w-p1', wbsId: 'w-1-1', actualWorkDescription: 'Built scanner UI and added a hidden experimental facial recognition feature not in requirements.', progressPercentage: 100, timestamp: new Date().toISOString() }
  ],
  analysis: {
    variances: ["Hidden 'Facial Recognition' feature detected which is not in the scope baseline."],
    scopeCreepIdentified: true,
    recommendations: ["Immediately halt facial recognition work.", "Submit a Change Request if feature is desired."],
    changeRequestSuggestions: [{ title: "Remove Unauthorized Feature", description: "Revert facial recognition code to align with 2.4 Baseline.", type: "Corrective Action", impactAnalysis: "Reduces technical debt." }]
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'structure' | 'baseline' | 'performance' | 'control' | 'validate' | 'reports'>('dashboard');
  const [showGuide, setShowGuide] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState<number | null>(null);
  
  // State for Process 2.4
  const [scopeStatement, setScopeStatement] = useState<ProjectScopeStatement>(demoData.scopeStatement);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [wbs, setWbs] = useState<WBSItem[]>([]);
  const [isBaselineLocked, setIsBaselineLocked] = useState(false);

  // State for Process 2.5 & 2.6
  const [workPerformance, setWorkPerformance] = useState<WorkPerformanceData[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [analysis, setAnalysis] = useState<ScopeAnalysisResult | null>(null);
  const [report, setReport] = useState<ScopeReport | null>(null);
  const [lessons, setLessons] = useState<LessonsLearned[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);

  // Sync deliverables with WBS (only work packages)
  useEffect(() => {
    const workPackages = wbs.filter(item => item.isWorkPackage);
    const newDeliverables = workPackages.map(item => {
      const existing = deliverables.find(d => d.wbsId === item.id);
      if (existing) return existing;
      return {
        id: `del-${item.id}`,
        wbsId: item.id,
        name: `Deliverable for ${item.name}`,
        status: 'Pending' as const,
        qualityReportSummary: 'Awaiting quality verification.',
        checklist: [],
        evidence: [],
        auditLogs: [{ id: `log-${Date.now()}`, action: 'Created', actor: 'System', timestamp: new Date().toISOString(), details: 'Component initialized from WBS.' }]
      };
    });
    setDeliverables(newDeliverables);
  }, [wbs]);

  const startWalkthrough = () => {
    setScopeStatement(walkthroughProject.scope);
    setRequirements(walkthroughProject.reqs);
    setWbs(walkthroughProject.wbs);
    setWorkPerformance(walkthroughProject.performance);
    setAnalysis(walkthroughProject.analysis);
    setIsBaselineLocked(true);
    setActiveTab('structure');
    setWalkthroughStep(0);
  };

  const nextStep = () => {
    if (walkthroughStep === null) return;
    const next = walkthroughStep + 1;
    setWalkthroughStep(next);
    if (next === 1) setActiveTab('structure');
    if (next === 2) setActiveTab('control');
    if (next === 3) {
      setActiveTab('validate');
      setSelectedDeliverableId(`del-${walkthroughProject.wbs[1].id}`);
    }
    if (next === 4) setWalkthroughStep(null);
  };

  const loadDemoData = () => {
    setScopeStatement(demoData.scopeStatement);
    setRequirements(demoData.reqs);
    setWorkPerformance(demoData.performance);
    setActiveTab('structure');
  };

  const runDecomposition = async () => {
    if (!scopeStatement.description) {
      alert("Please provide a Scope Statement description.");
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await decomposeScopeToWBS(scopeStatement, requirements);
      setWbs(result);
    } catch (error) {
      alert("Decomposition failed. Check AI API status.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleChecklistItem = (delId: string, itemId: string) => {
    setDeliverables(prev => prev.map(d => {
      if (d.id === delId) {
        return {
          ...d,
          checklist: d.checklist.map(item => item.id === itemId ? { ...item, isMet: !item.isMet } : item)
        };
      }
      return d;
    }));
  };

  const addEvidence = (delId: string, content: string) => {
    const newEvidence: Evidence = {
      id: `ev-${Date.now()}`,
      type: 'Text',
      content,
      timestamp: new Date().toISOString()
    };
    setDeliverables(prev => prev.map(d => d.id === delId ? { ...d, evidence: [newEvidence, ...d.evidence] } : d));
    addAuditLog(delId, 'Evidence Added', 'Inspector', 'Technical evidence record attached.');
  };

  const addAuditLog = (id: string, action: string, actor: string, details: string) => {
    const newLog: AuditLogEntry = { id: `log-${Date.now()}`, action, actor, timestamp: new Date().toISOString(), details };
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, auditLogs: [newLog, ...d.auditLogs] } : d));
  };

  const initChecklist = async (delId: string) => {
    const del = deliverables.find(d => d.id === delId);
    const wbsItem = wbs.find(w => w.id === del?.wbsId);
    if (!del || !wbsItem) return;

    setIsAnalyzing(true);
    try {
      const checklist = await generateInspectionChecklist(wbsItem, requirements);
      updateDeliverable(delId, { checklist });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateDeliverable = (id: string, updates: Partial<Deliverable>) => {
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const handleFinalValidation = async (del: Deliverable) => {
    const wbsItem = wbs.find(w => w.id === del.wbsId);
    if (!wbsItem) return;
    setIsAnalyzing(true);
    try {
      const result = await validateDeliverableWithEvidence(del, wbsItem, requirements);
      const newStatus = result.isAccepted ? 'Accepted' : 'Rejected';
      updateDeliverable(del.id, { status: newStatus, validationNotes: result.feedback, acceptedBy: result.isAccepted ? 'Project Sponsor' : undefined });
      addAuditLog(del.id, 'Validation Decision', 'Stakeholder', `Result: ${newStatus}. ${result.feedback}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runControlScope = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeScopeControl(wbs, requirements, workPerformance);
      setAnalysis(result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateFullReport = async () => {
    setIsAnalyzing(true);
    try {
      const reportData = await generateScopeReport(wbs, deliverables, changeRequests);
      setReport(reportData);
      const lessonsData = await generateLessonsLearned(deliverables.flatMap(d => d.auditLogs));
      setLessons(lessonsData);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const stats = useMemo(() => {
    const total = deliverables.length || 1;
    const accepted = deliverables.filter(d => d.status === 'Accepted').length;
    return {
      completion: Math.round((accepted / total) * 100),
      accepted,
      totalWPs: deliverables.length,
      baselineSize: wbs.length
    };
  }, [deliverables, wbs]);

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-100 ring-4 ring-indigo-50">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter">ScopeMaster <span className="text-indigo-600">Pro</span></h1>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">PMBOK 8th Edition</span>
               <div className="w-1 h-1 rounded-full bg-slate-300"></div>
               <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Active Workspace</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={startWalkthrough}
            className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-5 py-2.5 rounded-2xl font-bold transition text-xs border border-emerald-100"
          >
            <PlayCircle className="w-4 h-4" /> Demo Walkthrough
          </button>
          <button 
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-5 py-2.5 rounded-2xl font-bold transition text-xs border border-indigo-100"
          >
            <HelpCircle className="w-4 h-4" /> PM Guide
          </button>
          <button onClick={loadDemoData} disabled={wbs.length > 0} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-2xl font-bold transition text-xs disabled:opacity-50">
            <Database className="w-4 h-4" /> Import Demo
          </button>
          <button 
            onClick={() => setIsBaselineLocked(!isBaselineLocked)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold transition text-xs shadow-lg ${isBaselineLocked ? 'bg-amber-100 text-amber-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            {isBaselineLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {isBaselineLocked ? "Baseline Locked" : "Finalize Baseline"}
          </button>
        </div>
      </header>

      {/* WALKTHROUGH OVERLAY */}
      {walkthroughStep !== null && (
        <div className="fixed inset-x-0 bottom-10 z-[110] flex justify-center animate-in slide-in-from-bottom-10">
          <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-2xl w-full max-w-2xl border border-white/10 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-500 text-white p-2 rounded-xl"><PlayCircle className="w-5 h-5" /></span>
                <div>
                   <h3 className="font-black text-lg">Student Attendance App Demo</h3>
                   <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Guided Walkthrough — Step {walkthroughStep + 1} of 4</p>
                </div>
              </div>
              <button onClick={() => setWalkthroughStep(null)} className="text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="mb-8">
              {walkthroughStep === 0 && (
                <p className="text-slate-300 leading-relaxed font-medium">Welcome! We've loaded the <b>"Student Attendance Mobile App"</b> project. In this walkthrough, you'll see how to go from high-level scope to a verified deliverable using PMBOK standards.</p>
              )}
              {walkthroughStep === 1 && (
                <div className="space-y-3">
                   <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest">Process 2.4 — Develop Scope Structure</p>
                   <p className="text-slate-300 leading-relaxed">Here, we've defined our <b>Scope Statement</b>. Notice how the requirements are converted into a hierarchical <b>WBS</b>. This creates our 'Rule of 100%' — the baseline for all future work.</p>
                </div>
              )}
              {walkthroughStep === 2 && (
                <div className="space-y-3">
                   <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest">Process 2.5 — Control Scope</p>
                   <p className="text-slate-300 leading-relaxed">The team accidentally added a "Facial Recognition" feature. Since this isn't in our 2.4 Baseline, the AI has flagged it as <b>Scope Creep</b>. We now have a corrective action to stay on track.</p>
                </div>
              )}
              {walkthroughStep === 3 && (
                <div className="space-y-3">
                   <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest">Process 2.6 — Validate Scope</p>
                   <p className="text-slate-300 leading-relaxed">Finally, we validate the "Scanner UI". We run an AI-generated checklist, upload evidence (like a test report), and get formal sign-off from the stakeholder.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button 
                onClick={() => setWalkthroughStep(Math.max(0, walkthroughStep - 1))}
                disabled={walkthroughStep === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black bg-white/5 hover:bg-white/10 transition disabled:opacity-20"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button 
                onClick={nextStep}
                className="flex items-center gap-2 px-10 py-3 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 transition shadow-xl shadow-indigo-900"
              >
                {walkthroughStep === 3 ? "Finish Demo" : "Next Step"} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PMBOK WORKFLOW MODAL */}
      {showGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black tracking-tight">Project Manager's Guide</h3>
                <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1">PMBOK® 8th Edition Workflow</p>
              </div>
              <button onClick={() => setShowGuide(false)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">
              <GuideStep 
                num="1" 
                title="Planning — Develop Scope Structure (2.4)" 
                icon={<GanttChart className="text-indigo-600" />}
                content={
                  <ul className="space-y-3 text-sm text-slate-600 font-medium">
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Input your high-level description and deliverables in the <b>Scope Structure</b> tab.</li>
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Execute AI decomposition to create a hierarchical WBS that follows the <b>100% Rule</b>.</li>
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Refine the <b>Baseline Dictionary</b> acceptance criteria for each work package.</li>
                    <li className="flex gap-3 font-bold text-slate-900"><ChevronRight className="w-4 h-4 text-indigo-600 shrink-0" /> Final Step: Click "Finalize Baseline" to lock your planning data.</li>
                  </ul>
                }
              />

              <GuideStep 
                num="2" 
                title="Monitoring — Control Scope (2.5)" 
                icon={<BarChart3 className="text-indigo-600" />}
                content={
                  <ul className="space-y-3 text-sm text-slate-600 font-medium">
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Navigate to <b>Work Performance</b> as the team completes tasks.</li>
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Log actual work descriptions for specific Work Packages.</li>
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Run the <b>AI Variance Scan</b> to detect "Scope Creep" or baseline deviations.</li>
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Review AI-recommended corrective actions and draft Change Requests if needed.</li>
                  </ul>
                }
              />

              <GuideStep 
                num="3" 
                title="Validation — Validate Scope (2.6)" 
                icon={<CheckSquare className="text-indigo-600" />}
                content={
                  <ul className="space-y-3 text-sm text-slate-600 font-medium">
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Select a completed package from the <b>Registry</b>.</li>
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Use <b>AI Check-Prep</b> to convert WBS Dictionary criteria into an inspection checklist.</li>
                    <li className="flex gap-3"><ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" /> Record test results or artifacts in the <b>Evidence Logs</b> during stakeholder walkthroughs.</li>
                    <li className="flex gap-3 font-bold text-slate-900"><ChevronRight className="w-4 h-4 text-indigo-600 shrink-0" /> Submit the inspection for final AI decision on formal acceptance.</li>
                  </ul>
                }
              />
            </div>
            
            <div className="bg-slate-50 p-8 flex justify-end">
              <button 
                onClick={() => setShowGuide(false)}
                className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition uppercase text-xs tracking-widest"
              >
                Start Managing Scope
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 bg-white border-r border-slate-200 p-8 space-y-2 flex-shrink-0">
          <div className="pb-6 px-2">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Planning (2.4)</p>
          </div>
          <NavItem icon={<GanttChart />} label="Scope Structure" active={activeTab === 'structure'} onClick={() => setActiveTab('structure')} />
          <NavItem icon={<ClipboardCheck />} label="Baseline Dictionary" active={activeTab === 'baseline'} onClick={() => setActiveTab('baseline')} />
          
          <div className="py-6 px-2 border-t border-slate-100 mt-4">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Monitoring & Validation</p>
          </div>
          <NavItem icon={<LayoutDashboard />} label="Performance Dash" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Clock />} label="Work Performance" active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} />
          <NavItem icon={<BarChart3 />} label="Control Scope (2.5)" active={activeTab === 'control'} onClick={() => setActiveTab('control')} />
          <NavItem icon={<CheckSquare />} label="Validate Scope (2.6)" active={activeTab === 'validate'} onClick={() => setActiveTab('validate')} />
          <NavItem icon={<FileText />} label="Reporting Artifacts" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </aside>

        <main className="flex-1 overflow-y-auto p-12 bg-slate-50/50">
          {activeTab === 'structure' && (
            <div className="space-y-10 animate-in fade-in duration-500 max-w-6xl mx-auto">
              <SectionHeader title="Develop Scope Structure" subtitle="Process 2.4: Decomposing project scope into manageable work packages." />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-indigo-50 p-3 rounded-2xl"><FileText className="w-6 h-6 text-indigo-600" /></div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Project Scope Statement</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Project Description</label>
                      <textarea 
                        disabled={isBaselineLocked}
                        className="w-full text-sm p-5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-50 outline-none h-32 bg-slate-50/30 transition resize-none"
                        value={scopeStatement.description}
                        onChange={(e) => setScopeStatement({...scopeStatement, description: e.target.value})}
                        placeholder="Define the project scope clearly..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Major Deliverables (List)</label>
                      <input 
                        disabled={isBaselineLocked}
                        className="w-full text-sm p-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-50 outline-none bg-slate-50/30 transition"
                        value={scopeStatement.deliverables.join(", ")}
                        onChange={(e) => setScopeStatement({...scopeStatement, deliverables: e.target.value.split(", ")})}
                        placeholder="Deliverable A, Deliverable B..."
                      />
                    </div>
                    <div className="pt-4">
                      <button 
                        onClick={runDecomposition} 
                        disabled={isAnalyzing || isBaselineLocked}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        <GitBranch className="w-5 h-5" /> {isAnalyzing ? 'AI Decomposing Scope...' : 'Auto-Generate Hierarchical WBS'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-50 p-3 rounded-2xl"><GitBranch className="w-6 h-6 text-emerald-600" /></div>
                      <h3 className="text-lg font-black text-slate-800 tracking-tight">Hierarchical Structure</h3>
                    </div>
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{wbs.length} ELEMENTS</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {wbs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-100 rounded-3xl">
                        <Users className="w-12 h-12 text-slate-200 mb-4" />
                        <p className="text-slate-400 text-sm italic">Define scope and run AI decomposition to view the structure.</p>
                      </div>
                    ) : (
                      wbs.map(item => (
                        <div 
                          key={item.id} 
                          className={`p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                            item.isWorkPackage ? 'bg-indigo-50/30 border-indigo-100 ml-8' : 'bg-slate-50 border-slate-100 font-bold'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black font-mono text-indigo-500 bg-white border border-indigo-50 px-2 py-0.5 rounded-lg">{item.code}</span>
                            <span className="text-sm tracking-tight">{item.name}</span>
                          </div>
                          {item.isWorkPackage && (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white px-2 py-0.5 rounded-md shadow-sm">Work Package</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'baseline' && (
            <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
              <SectionHeader title="WBS Dictionary & Baseline" subtitle="Outputs of 2.4: The formal Scope Baseline used for monitor & control." />
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-800 tracking-tighter uppercase">WBS Dictionary View</h3>
                  <button className="flex items-center gap-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl transition uppercase tracking-widest border border-dashed border-indigo-200">
                    <FileDown className="w-4 h-4" /> Export Baseline PDF
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">
                      <tr>
                        <th className="px-10 py-6">WBS Code</th>
                        <th className="px-10 py-6">Component / Deliverable</th>
                        <th className="px-10 py-6">Dictionary Entry (Scope Description)</th>
                        <th className="px-10 py-6">Acceptance Criteria</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {wbs.length === 0 && (
                        <tr><td colSpan={4} className="p-20 text-center text-slate-300 italic">No structure developed. Complete Process 2.4 first.</td></tr>
                      )}
                      {wbs.map(item => (
                        <tr key={item.id} className={`text-sm group hover:bg-slate-50/50 transition ${!item.isWorkPackage ? 'bg-slate-50/30' : ''}`}>
                          <td className="px-10 py-8 font-mono text-indigo-600 font-bold">{item.code}</td>
                          <td className="px-10 py-8">
                            <p className={`font-black text-slate-800 ${!item.isWorkPackage ? 'text-base' : ''}`}>{item.name}</p>
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1 block">Level {item.code.split('.').length}</span>
                          </td>
                          <td className="px-10 py-8 text-slate-500 max-w-md leading-relaxed text-xs">{item.description}</td>
                          <td className="px-10 py-8 italic text-slate-600 text-xs font-medium border-l border-slate-100">{item.acceptanceCriteria}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in duration-500 max-w-6xl mx-auto">
              <SectionHeader title="Project Scope Dashboard" subtitle="Monitoring 2.5 & Validation 2.6 metrics based on the established structure." />
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <StatCard label="Overall Acceptance" value={`${stats.completion}%`} icon={<Zap className="text-indigo-600" />} />
                <StatCard label="Structure Nodes" value={stats.baselineSize} icon={<GitBranch className="text-emerald-600" />} />
                <StatCard label="Work Packages" value={stats.totalWPs} icon={<Database className="text-blue-600" />} />
                <StatCard label="Open Change Requests" value={changeRequests.length} icon={<AlertTriangle className="text-orange-600" />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-10">
                  <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 tracking-tighter uppercase text-sm"><BarChart3 className="w-5 h-5 text-indigo-500" /> Deliverable Tracking (WP Level)</h3>
                  <div className="space-y-4">
                    {deliverables.length === 0 && <p className="text-slate-300 italic text-center py-10">No deliverables generated from work packages yet.</p>}
                    {deliverables.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition">
                        <div>
                          <p className="text-sm font-black text-slate-800">{d.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">WBS: {wbs.find(w => w.id === d.wbsId)?.code}</span>
                            <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                            <span className="text-[9px] font-bold text-slate-400">Process 2.6 Active</span>
                          </div>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10">
                  <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 tracking-tighter uppercase text-sm"><History className="w-5 h-5 text-indigo-500" /> Scope Activity Feed</h3>
                  <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
                    {deliverables.flatMap(d => d.auditLogs).slice(0, 5).map(log => (
                      <div key={log.id} className="flex gap-6 items-start relative z-10">
                        <div className="w-[23px] h-[23px] rounded-full bg-indigo-600 border-4 border-white shadow-sm flex-shrink-0"></div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-widest">{log.action}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{log.details}</p>
                          <p className="text-[9px] text-indigo-500 font-black mt-1 uppercase tracking-tighter">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'validate' && (
            <div className="space-y-10 animate-in fade-in duration-500 max-w-6xl mx-auto">
              <SectionHeader title="Formal Deliverable Validation" subtitle="Process 2.6: Reviewing work packages against WBS Dictionary acceptance criteria." />
              
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                <div className="lg:col-span-1 space-y-4">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-2 mb-4">Work Package Registry</p>
                  <div className="space-y-3">
                    {deliverables.map(del => (
                      <button 
                        key={del.id}
                        onClick={() => setSelectedDeliverableId(del.id)}
                        className={`w-full p-6 rounded-3xl border text-left transition-all relative overflow-hidden group shadow-sm ${
                          selectedDeliverableId === del.id ? 'bg-slate-900 text-white border-slate-900 shadow-2xl' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-3">
                           <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${selectedDeliverableId === del.id ? 'text-indigo-400' : 'text-slate-400'}`}>WBS {wbs.find(w => w.id === del.wbsId)?.code}</span>
                           <StatusBadge status={del.status} light={selectedDeliverableId === del.id} />
                        </div>
                        <h4 className="font-black text-xs tracking-tight group-hover:translate-x-1 transition-transform">{del.name}</h4>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-3 space-y-10">
                  {!selectedDeliverableId ? (
                    <div className="h-[600px] bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-20 text-center shadow-inner">
                      <div className="bg-slate-50 p-8 rounded-full mb-8"><CheckSquare className="w-12 h-12 text-slate-200" /></div>
                      <h3 className="text-2xl font-black text-slate-700 tracking-tight">Select Package for Inspection</h3>
                      <p className="text-slate-400 text-sm max-w-xs mt-3 font-medium leading-relaxed">Validation confirms deliverables meet the baseline criteria approved in Process 2.4.</p>
                    </div>
                  ) : (() => {
                    const del = deliverables.find(d => d.id === selectedDeliverableId)!;
                    const wbsItem = wbs.find(w => w.id === del.wbsId)!;
                    return (
                      <div className="space-y-8 animate-in slide-in-from-right-12 duration-500">
                        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                          <div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{del.name}</h2>
                            <div className="flex items-center gap-3 mt-2">
                               <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">Dictionary Target: {wbsItem.code}</span>
                               <span className="text-xs text-slate-400 font-medium">{wbsItem.name}</span>
                            </div>
                          </div>
                          <div className="flex gap-4 w-full md:w-auto">
                            {del.checklist.length === 0 && (
                              <button onClick={() => initChecklist(del.id)} disabled={isAnalyzing} className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-3 hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 disabled:opacity-50">
                                <Zap className="w-4 h-4" /> AI Check-Prep
                              </button>
                            )}
                            <button onClick={() => handleFinalValidation(del)} disabled={del.status === 'Accepted' || isAnalyzing} className="flex-1 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black hover:bg-slate-800 transition disabled:opacity-50 border border-slate-800">
                              Submit to Review
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 tracking-tighter uppercase text-xs">
                              <CheckSquare className="w-5 h-5 text-indigo-500" /> Acceptance Checklist
                            </h3>
                            <div className="space-y-3">
                              {del.checklist.length === 0 ? (
                                <p className="text-slate-300 text-sm italic py-10 text-center border-2 border-dashed border-slate-50 rounded-2xl">Awaiting inspection logic generation...</p>
                              ) : del.checklist.map(item => (
                                <label key={item.id} className="flex items-start gap-4 p-5 rounded-2xl hover:bg-slate-50 transition cursor-pointer border border-transparent hover:border-slate-100 group">
                                  <input 
                                    type="checkbox" 
                                    checked={item.isMet} 
                                    onChange={() => toggleChecklistItem(del.id, item.id)}
                                    className="mt-0.5 w-5 h-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-4 focus:ring-indigo-50 transition" 
                                  />
                                  <span className={`text-sm font-bold ${item.isMet ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
                            <h3 className="font-black text-slate-800 mb-8 flex items-center gap-3 tracking-tighter uppercase text-xs">
                              <Paperclip className="w-5 h-5 text-indigo-500" /> Validation Evidence
                            </h3>
                            <div className="flex-1 space-y-4 mb-8 overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
                              {del.evidence.length === 0 ? (
                                <p className="text-slate-300 text-xs italic py-10 text-center">No audit evidence provided.</p>
                              ) : del.evidence.map(ev => (
                                <div key={ev.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 relative group hover:bg-white transition-colors">
                                  <div className="flex justify-between mb-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">System ID: {ev.id.split('-').pop()}</span>
                                    <span className="text-[9px] font-bold text-slate-300">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <p className="text-xs text-slate-700 font-medium leading-relaxed italic">"{ev.content}"</p>
                                </div>
                              ))}
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); addEvidence(del.id, fd.get('content') as string); (e.target as HTMLFormElement).reset(); }} className="space-y-4">
                              <textarea name="content" required className="w-full text-xs p-5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-50 outline-none h-24 bg-slate-50/50 resize-none transition" placeholder="Paste technical inspection details or links to verification artifacts..."></textarea>
                              <button type="submit" className="w-full text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 py-3 rounded-2xl shadow-lg shadow-indigo-100 uppercase tracking-widest transition">Add To Audit Evidence</button>
                            </form>
                          </div>
                        </div>

                        {del.validationNotes && (
                          <div className="bg-white border-4 border-indigo-600/5 p-10 rounded-3xl flex gap-8 items-start shadow-xl shadow-indigo-100/20">
                             <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-200"><Info className="w-8 h-8 text-white" /></div>
                             <div className="space-y-2">
                                <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">Formal Inspection Result</h4>
                                <p className="text-slate-700 italic text-lg font-black tracking-tight leading-relaxed">"{del.validationNotes}"</p>
                                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center gap-4">
                                   <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-bold text-white uppercase">SP</div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reviewed by Senior Product Sponsor</p>
                                </div>
                             </div>
                          </div>
                        )}
                        
                        <ManagementGuide process="2.6" />
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
             <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
                <SectionHeader title="Log Work Performance" subtitle="Capturing Process 2.5 input data for monitoring variances against structure." />
                <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm">
                   <form className="space-y-8" onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const newData: WorkPerformanceData = {
                        id: `p-${Date.now()}`,
                        wbsId: fd.get('wbsId') as string,
                        actualWorkDescription: fd.get('desc') as string,
                        progressPercentage: Number(fd.get('progress')),
                        timestamp: new Date().toISOString()
                      };
                      setWorkPerformance([newData, ...workPerformance]);
                      (e.target as HTMLFormElement).reset();
                   }}>
                      <div className="grid grid-cols-2 gap-8">
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Target Work Package</label>
                            <select name="wbsId" className="w-full rounded-2xl border border-slate-200 p-5 text-sm focus:ring-4 focus:ring-indigo-50 outline-none bg-slate-50/50 font-bold transition">
                               {wbs.filter(w => w.isWorkPackage).map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                            </select>
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Current Progress %</label>
                            <input type="number" name="progress" min="0" max="100" defaultValue="0" className="w-full rounded-2xl border border-slate-200 p-5 text-sm focus:ring-4 focus:ring-indigo-50 outline-none bg-slate-50/50 font-black transition" />
                         </div>
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Actual Work Performed</label>
                         <textarea name="desc" required className="w-full rounded-3xl border border-slate-200 p-6 text-sm focus:ring-4 focus:ring-indigo-50 outline-none h-40 bg-slate-50/50 resize-none transition font-medium" placeholder="Describe technical tasks completed since last update..."></textarea>
                      </div>
                      <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm shadow-2xl hover:bg-slate-800 transition uppercase tracking-widest">Commit Performance Record</button>
                   </form>
                </div>
             </div>
          )}

          {activeTab === 'control' && (
            <div className="space-y-10 animate-in fade-in duration-500 max-w-6xl mx-auto">
              <SectionHeader title="Process 2.5: Control Scope" subtitle="Monitoring performance data against the Scope Baseline structure." />
              {!analysis ? (
                <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center shadow-inner">
                  <BarChart3 className="w-16 h-16 text-slate-100 mb-8" />
                  <h3 className="text-2xl font-black text-slate-700 tracking-tight">Scope Performance Gap Analysis</h3>
                  <p className="text-slate-400 max-w-md mt-4 font-medium leading-relaxed">AI will scan work performance logs and compare them against the hierarchical WBS to identify unauthorized scope additions.</p>
                  <button onClick={runControlScope} className="mt-10 bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition flex items-center gap-4 text-sm uppercase tracking-widest">
                    <Zap className="w-6 h-6" /> Execute AI Performance Scan
                  </button>
                  <div className="mt-12 w-full max-w-2xl">
                     <ManagementGuide process="2.5" />
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="font-black text-slate-800 flex items-center gap-3 text-xs uppercase tracking-widest">
                          <AlertTriangle className={`w-5 h-5 ${analysis.scopeCreepIdentified ? 'text-orange-500' : 'text-emerald-500'}`} />
                          Variance Diagnostics
                        </h3>
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${analysis.scopeCreepIdentified ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                          {analysis.scopeCreepIdentified ? 'Creep Detected' : 'Baseline Compliant'}
                        </span>
                      </div>
                      <div className="space-y-4">
                        {analysis.variances.map((v, i) => (
                          <div key={i} className="flex gap-5 p-6 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-medium text-slate-700 group hover:bg-white transition shadow-sm">
                            <div className="bg-white w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border border-slate-100 text-indigo-600 shadow-sm flex-shrink-0">{i+1}</div>
                            <p className="leading-relaxed">{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-900 p-12 rounded-[40px] text-white shadow-2xl space-y-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-10 opacity-10"><Zap className="w-40 h-40" /></div>
                      <h3 className="font-black text-indigo-400 flex items-center gap-3 uppercase text-xs tracking-[0.2em] relative z-10">
                        <Zap className="w-5 h-5" /> Recommended Corrective Actions
                      </h3>
                      <div className="space-y-6 relative z-10">
                        {analysis.recommendations.map((r, i) => (
                          <div key={i} className="flex items-start gap-5">
                            <CheckCircle2 className="w-6 h-6 text-indigo-400 mt-1 flex-shrink-0" />
                            <p className="text-slate-300 text-sm leading-relaxed font-medium">{r}</p>
                          </div>
                        ))}
                      </div>
                      <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg"><Save className="w-5 h-5" /></div>
                            <div>
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Decision Status</p>
                               <p className="text-xs font-bold text-slate-100">Awaiting Approval</p>
                            </div>
                         </div>
                         <button className="bg-indigo-600 text-white px-8 py-4 rounded-2xl text-xs font-black hover:bg-indigo-500 transition shadow-xl shadow-indigo-900/50 uppercase tracking-widest">Finalize Change Request</button>
                      </div>
                    </div>
                  </div>
                  <ManagementGuide process="2.5" />
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-12 animate-in fade-in duration-500 max-w-6xl mx-auto">
              <div className="flex justify-between items-end">
                <SectionHeader title="Artifact Registry" subtitle="Official ITTO outputs from Processes 2.4, 2.5, and 2.6." />
                <button onClick={generateFullReport} disabled={isAnalyzing || wbs.length === 0} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs flex items-center gap-3 shadow-2xl hover:bg-slate-800 transition disabled:opacity-50 uppercase tracking-widest">
                   <FileDown className="w-4 h-4" /> {isAnalyzing ? 'Compiling...' : 'Publish Project Artifacts'}
                </button>
              </div>

              {!report ? (
                 <div className="bg-white p-24 rounded-[40px] border border-slate-200 text-center flex flex-col items-center shadow-inner">
                    <FileText className="w-20 h-20 text-slate-100 mb-8" />
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight italic opacity-40">No Compiled Governance Data</h3>
                    <p className="text-slate-400 mt-4 max-w-md font-medium">Artifacts include scope performance reports, validated deliverable logs, and hierarchical baseline records.</p>
                 </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="bg-white p-12 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                    <div className="flex justify-between items-start">
                       <h3 className="text-sm font-black text-slate-800 tracking-widest uppercase">Performance Artifact (2.5)</h3>
                       <span className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">HEALTH: {report.healthScore}/100</span>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 italic">
                      <p className="text-sm text-slate-600 leading-relaxed font-bold">"{report.summary}"</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Acceptance Metric</p>
                          <p className="text-3xl font-black text-indigo-600">{report.acceptanceRate}%</p>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Scope Variance Count</p>
                          <p className="text-3xl font-black text-slate-800">{report.deviationsCount}</p>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <div className="bg-white p-12 rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                      <h3 className="text-sm font-black text-slate-800 mb-10 tracking-widest uppercase">Validated Deliverables (2.6)</h3>
                      <div className="space-y-4">
                        {deliverables.filter(d => d.status === 'Accepted').length === 0 && <p className="text-slate-300 text-sm italic text-center py-10">No formal acceptances recorded.</p>}
                        {deliverables.filter(d => d.status === 'Accepted').map(d => (
                          <div key={d.id} className="flex items-center gap-6 p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100 transition hover:bg-white">
                             <div className="bg-white p-3 rounded-2xl shadow-sm border border-emerald-50"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
                             <div>
                                <h4 className="text-sm font-black text-slate-800">{d.name}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Accepted by {d.acceptedBy}</p>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-12 rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                      <h3 className="text-sm font-black text-slate-800 mb-10 tracking-widest uppercase">Lessons Learned Repository</h3>
                      <div className="space-y-4">
                        {lessons.map(ls => (
                          <div key={ls.id} className="p-8 bg-slate-50 rounded-3xl border border-slate-100 space-y-3 hover:bg-white transition-colors">
                             <div className="flex items-center gap-3">
                                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{ls.category}</span>
                             </div>
                             <p className="text-sm font-black text-slate-800 tracking-tight leading-tight">{ls.description}</p>
                             <p className="text-xs text-slate-500 font-medium leading-relaxed italic">Recommendation: {ls.recommendation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <footer className="bg-white border-t border-slate-200 px-10 py-5 flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">
        <div className="flex gap-10">
           <p>PMBOK 8th Edition Compliant</p>
           <p>Process 2.4/2.5/2.6 Engine</p>
        </div>
        <div className="flex gap-10">
          <span className="flex items-center gap-3 text-emerald-500"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div> Gemini-3 FLASH Active</span>
          <p className="opacity-50">v2.4.1 Structure Update</p>
        </div>
      </footer>
    </div>
  );
};

// IN-APP GUIDANCE PANEL
const ManagementGuide: React.FC<{ process: '2.5' | '2.6' }> = ({ process }) => (
  <div className="bg-white rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-50/50 overflow-hidden mt-8">
    <div className="bg-indigo-600 p-4 flex items-center gap-3">
       <BookOpen className="text-white w-5 h-5" />
       <h4 className="text-white text-xs font-black uppercase tracking-widest">Scope Management Guide — Process {process}</h4>
    </div>
    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div>
          <h5 className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-tighter mb-2">
            <Target className="w-4 h-4" /> Performance Metrics
          </h5>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {process === '2.5' 
              ? "Scope Health is calculated by comparing actual work performance against the approved WBS codes. If a team member logs work that doesn't match a code, 'Scope Creep' is flagged automatically." 
              : "The Acceptance Rate tracks how many Work Packages passed inspection on the first try. High rates indicate clear requirement definitions in Process 2.4."}
          </p>
        </div>
        <div>
          <h5 className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-tighter mb-2">
            <History className="w-4 h-4" /> Lessons Learned Engine
          </h5>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            AI scans every audit log (rejections, variances, and evidence notes). It looks for recurring words like 'vague' or 'missing' to suggest improvements for the next planning phase.
          </p>
        </div>
      </div>
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <h5 className="flex items-center gap-2 text-indigo-900 font-black text-xs uppercase tracking-widest mb-4">
          <Lightbulb className="w-4 h-4 text-amber-500" /> PM Pro Tip
        </h5>
        <p className="text-xs text-slate-600 font-bold italic leading-relaxed">
          "The WBS Dictionary is your strongest shield. Process 2.4 is where you win the project. If your 'Acceptance Criteria' are vague here, Process 2.6 (Validation) will be painful. Be specific, be measurable."
        </p>
        <div className="mt-6 pt-4 border-t border-slate-200">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Linked PMBOK Focus: 2.4 Structure Adherence</span>
        </div>
      </div>
    </div>
  </div>
);

const GuideStep: React.FC<{ num: string, title: string, content: React.ReactNode, icon: React.ReactNode }> = ({ num, title, content, icon }) => (
  <div className="flex gap-8 group">
    <div className="flex flex-col items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-lg border-4 border-slate-50 group-hover:bg-indigo-600 transition-colors">
        {num}
      </div>
      <div className="w-[2px] flex-1 bg-slate-100 group-last:hidden"></div>
    </div>
    <div className="flex-1 pb-12">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-indigo-50 p-2 rounded-lg">{icon}</div>
        <h4 className="text-xl font-black text-slate-800 tracking-tight">{title}</h4>
      </div>
      <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
        {content}
      </div>
    </div>
  </div>
);

const NavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-xs transition-all group tracking-widest uppercase ${
      active ? 'bg-slate-900 text-white shadow-2xl shadow-indigo-200 border-slate-900' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 border border-transparent'
    }`}
  >
    <span className={`transition-colors ${active ? 'text-indigo-400' : 'text-slate-300 group-hover:text-slate-500'}`}>{icon && React.cloneElement(icon as React.ReactElement, { size: 18 })}</span>
    {label}
  </button>
);

const SectionHeader: React.FC<{ title: string, subtitle: string }> = ({ title, subtitle }) => (
  <div className="space-y-2">
    <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight">{title}</h2>
    <p className="text-lg text-slate-400 font-medium tracking-tight">{subtitle}</p>
  </div>
);

const StatCard: React.FC<{ label: string, value: string | number, icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-indigo-200 transition-all hover:-translate-y-1">
    <div className="bg-slate-50 p-5 rounded-2xl group-hover:bg-indigo-50 transition shadow-inner">{icon}</div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: Deliverable['status'], light?: boolean }> = ({ status, light }) => {
  const styles = {
    Pending: light ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
    Verified: light ? 'bg-blue-200 text-blue-900' : 'bg-blue-50 text-blue-600 border border-blue-100',
    Accepted: light ? 'bg-emerald-400 text-emerald-900' : 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    Rejected: light ? 'bg-rose-400 text-rose-900' : 'bg-rose-50 text-rose-600 border border-rose-100'
  };
  return <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] ${styles[status]}`}>{status}</span>;
};

export default App;
