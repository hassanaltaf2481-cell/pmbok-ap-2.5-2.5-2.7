
import { GoogleGenAI, Type } from "@google/genai";
import { 
  WBSItem, 
  Requirement, 
  WorkPerformanceData, 
  Deliverable, 
  ScopeAnalysisResult, 
  ValidationResult,
  InspectionItem,
  LessonsLearned,
  ScopeReport,
  ChangeRequest,
  ProjectScopeStatement
} from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * PMBOK 2.4: Decompose Project Scope Statement and Requirements into a WBS.
 */
export const decomposeScopeToWBS = async (
  scopeStatement: ProjectScopeStatement,
  requirements: Requirement[]
): Promise<WBSItem[]> => {
  const prompt = `
    Act as a Senior Project Manager following PMBOK 8th Edition Process 2.4: Develop Scope Structure.
    Goal: Decompose the scope into a hierarchical Work Breakdown Structure (WBS).
    
    SCOPE STATEMENT:
    Description: ${scopeStatement.description}
    Deliverables: ${scopeStatement.deliverables.join(', ')}
    Exclusions: ${scopeStatement.exclusions.join(', ')}
    
    REQUIREMENTS:
    ${requirements.map(r => `- ${r.title} (${r.category})`).join('\n')}
    
    Instructions:
    1. Create a logical hierarchy (Level 1 Components down to Work Packages).
    2. Ensure the "100% Rule" is followed (the sum of the child elements equals 100% of the parent).
    3. Generate a WBS Dictionary entry for each element (description and acceptance criteria).
    4. Provide hierarchical codes (e.g., 1.0, 1.1, 1.1.1).
    
    Return the result as a JSON array of WBSItem objects.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            parentId: { type: Type.STRING, nullable: true },
            code: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            acceptanceCriteria: { type: Type.STRING },
            isWorkPackage: { type: Type.BOOLEAN },
            isApproved: { type: Type.BOOLEAN }
          },
          required: ["id", "code", "name", "description", "acceptanceCriteria", "isWorkPackage"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateInspectionChecklist = async (
  wbsItem: WBSItem,
  requirements: Requirement[]
): Promise<InspectionItem[]> => {
  const prompt = `
    Generate a PMBOK-compliant inspection checklist for Validate Scope (Process 2.6).
    WBS Component: ${wbsItem.name}
    Criteria: ${wbsItem.acceptanceCriteria}
    Related Requirements: ${JSON.stringify(requirements)}
    
    Output a detailed checklist of items that must be verified for formal stakeholder acceptance.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            label: { type: Type.STRING },
            isMet: { type: Type.BOOLEAN },
            notes: { type: Type.STRING }
          },
          required: ["id", "label", "isMet", "notes"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};

export const analyzeScopeControl = async (
  baseline: WBSItem[],
  requirements: Requirement[],
  performanceData: WorkPerformanceData[]
): Promise<ScopeAnalysisResult> => {
  const prompt = `
    Perform PMBOK 2.5 "Control Scope" analysis.
    Compare the Scope Baseline (WBS) and Requirements against the Work Performance Data.
    
    BASELINE: ${JSON.stringify(baseline)}
    REQUIREMENTS: ${JSON.stringify(requirements)}
    ACTUAL WORK: ${JSON.stringify(performanceData)}
    
    Identify:
    1. Variances (differences between planned and actual).
    2. Scope Creep (work done that is not in baseline).
    3. Missing work.
    4. Suggested Change Requests.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          variances: { type: Type.ARRAY, items: { type: Type.STRING } },
          scopeCreepIdentified: { type: Type.BOOLEAN },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          changeRequestSuggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                type: { type: Type.STRING },
                impactAnalysis: { type: Type.STRING }
              }
            }
          }
        },
        required: ["variances", "scopeCreepIdentified", "recommendations", "changeRequestSuggestions"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const validateDeliverableWithEvidence = async (
  deliverable: Deliverable,
  wbsItem: WBSItem,
  requirements: Requirement[]
): Promise<ValidationResult> => {
  const prompt = `
    Perform PMBOK 2.6 "Validate Scope" inspection.
    Deliverable: ${deliverable.name}
    Checklist Status: ${JSON.stringify(deliverable.checklist)}
    Evidence Provided: ${JSON.stringify(deliverable.evidence)}
    Acceptance Criteria: ${wbsItem.acceptanceCriteria}
    
    Should this deliverable be formally "Accepted" by the customer?
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isAccepted: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING },
          missingCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedAction: { type: Type.STRING }
        },
        required: ["isAccepted", "feedback", "missingCriteria", "suggestedAction"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateScopeReport = async (
  baseline: WBSItem[],
  deliverables: Deliverable[],
  changeRequests: ChangeRequest[]
): Promise<ScopeReport> => {
  const prompt = `
    Generate a Scope Performance Report for the project.
    Baseline size: ${baseline.length} components.
    Deliverables status: ${JSON.stringify(deliverables.map(d => ({ name: d.name, status: d.status })))}
    Change Requests: ${changeRequests.length}
    
    Return a summary of project health from a scope perspective (2.5 & 2.6 focus).
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING },
          summary: { type: Type.STRING },
          healthScore: { type: Type.NUMBER },
          deviationsCount: { type: Type.NUMBER },
          acceptanceRate: { type: Type.NUMBER }
        },
        required: ["timestamp", "summary", "healthScore", "deviationsCount", "acceptanceRate"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateLessonsLearned = async (
  auditLogs: any[]
): Promise<LessonsLearned[]> => {
  const prompt = `
    Analyze project audit logs to generate Scope Lessons Learned.
    Logs: ${JSON.stringify(auditLogs.slice(0, 20))}
    
    Identify patterns in rejections or deviations.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            category: { type: Type.STRING },
            description: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ["id", "category", "description", "recommendation"]
        }
      }
    }
  });
  return JSON.parse(response.text);
};
