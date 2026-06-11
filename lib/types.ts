export interface Publication {
  pmid: string;
  title: string;
  journal: string;
  year: number | null;
  date: string | null;
  authors: string[];
  isFirstAuthor: boolean;
  isLastAuthor: boolean;
  meshTerms: string[];
  abstract: string;
  url: string;
}

export interface Collaborator {
  name: string;
  coPublications: number;
}

export interface InstitutionSignal {
  name: string;
  mentions: number;
}

export interface InfluenceMap {
  totalPublications: number;
  distinctCollaborators: number;
  topCollaborators: Collaborator[];
  institutions: InstitutionSignal[];
  trialInvolvement: number;
  influenceScore: number; // 0-100 heuristic, derived signal only
  scoreBasis: string;
}

export interface TopicTrendPoint {
  period: string;
  topics: string[];
}

export interface ClinicalTrial {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  conditions: string[];
  sponsor: string;
  role: string;
  url: string;
}

export interface InterestTopic {
  topic: string;
  why: string;
  evidence: string;
}

export interface EngagementReport {
  sentimentTrajectory: string; // derived from the doctor's own publication record
  sentimentSignals: string[];
  interestTopics: InterestTopic[];
  talkingPoints: string[];
  lineOfQuestioning: string[];
  cautions: string[];
}

export interface AnalysisResult {
  query: { name: string; therapyArea: string };
  generatedAt: string;
  dataCoverage: {
    publicationsFound: number;
    earliestYear: number | null;
    latestYear: number | null;
    trialsFound: number;
  };
  publications: Publication[];
  topicTimeline: TopicTrendPoint[];
  influence: InfluenceMap;
  trials: ClinicalTrial[];
  report: EngagementReport | null;
  reportError: string | null;
  notes: string[];
}
