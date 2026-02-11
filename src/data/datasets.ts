import type { Dataset } from "../types";

export const DATASETS: Dataset[] = [
  {
    id: "hospitals",
    name: "US Hospitals",
    label: "Hospitals",
    description: "7,500+ hospitals across the United States",
    impact: "Find healthcare near you or research medical access equity",
    url: "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Hospitals_1/FeatureServer/0",
    fields: [
      "NAME", "ADDRESS", "CITY", "STATE", "ZIP", "TELEPHONE", "TYPE",
      "STATUS", "POPULATION", "COUNTY", "COUNTYFIPS", "COUNTRY",
      "LATITUDE", "LONGITUDE", "NAICS_CODE", "NAICS_DESC", "SOURCE",
      "SOURCEDATE", "VAL_METHOD", "VAL_DATE", "WEBSITE", "STATE_ID",
      "ALT_NAME", "ST_FIPS", "OWNER", "TTL_STAFF", "BEDS", "TRAUMA", "HELIPAD",
    ],
    keyFields:
      "NAME, CITY, STATE, TYPE, BEDS, TRAUMA, OWNER, HELIPAD, STATUS, COUNTY, TELEPHONE, WEBSITE",
    exampleQuestions: [
      "Show hospitals in California with more than 500 beds",
      "Find trauma centers in Texas",
      "Which hospitals have helipads in Florida?",
      "Show me government-owned hospitals in New York",
    ],
    icon: "map-pin",
    color: "#e74c3c",
  },
  {
    id: "schools",
    name: "US Public Schools",
    label: "Schools",
    description: "100,000+ public schools across the United States",
    impact: "Research schools for your family or study education equity",
    url: "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/ArcGIS/rest/services/Public_Schools/FeatureServer/0",
    fields: [
      "NAME", "ADDRESS", "CITY", "STATE", "ZIP", "TELEPHONE", "TYPE",
      "STATUS", "POPULATION", "COUNTY", "COUNTYFIPS", "COUNTRY",
      "LATITUDE", "LONGITUDE", "NAICS_CODE", "NAICS_DESC", "SOURCE",
      "SOURCEDATE", "VAL_METHOD", "VAL_DATE", "WEBSITE", "LEVEL_",
      "ENROLLMENT", "ST_GRADE", "END_GRADE", "FT_TEACHER", "SHELTER_ID",
    ],
    keyFields:
      "NAME, CITY, STATE, TYPE, LEVEL_, ENROLLMENT, ST_GRADE, END_GRADE, FT_TEACHER, COUNTY, TELEPHONE",
    exampleQuestions: [
      "Show high schools in Los Angeles County",
      "Find schools with enrollment over 2000 students",
      "Which schools in Ohio have more than 100 teachers?",
      "Show me elementary schools in Claremont, California",
    ],
    icon: "education",
    color: "#3498db",
  },
  {
    id: "cities",
    name: "US Major Cities",
    label: "Cities",
    description: "Major cities and populations across the US",
    impact: "Explore urbanization patterns and city demographics",
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Major_Cities_/FeatureServer/0",
    fields: [
      "FID", "FEATURE_CL", "FEATURE_ID", "NAME", "ST", "CAPITAL",
      "POP_2010", "POP_CLASS", "WHITE", "BLACK", "AMERI_ES", "ASIAN",
      "HAWN_PI", "HISPANIC", "OTHER", "MULT_RACE", "MALES", "FEMALES",
      "MED_AGE", "MED_AGE_M", "MED_AGE_F", "HOUSEHOLDS", "AVE_HH_SZ",
      "HSEHLD_1_M", "HSEHLD_1_F",
    ],
    keyFields:
      "NAME, ST, POP_2010, CAPITAL, WHITE, BLACK, ASIAN, HISPANIC, MALES, FEMALES, MED_AGE, HOUSEHOLDS",
    exampleQuestions: [
      "Show cities in California with population over 500000",
      "Which state capitals have the highest population?",
      "Find cities with median age over 40",
      "Show me cities in Texas with large Hispanic populations",
    ],
    icon: "urban-model",
    color: "#2ecc71",
  },
];

export const LLM_SYSTEM_PROMPT = `You are a GIS query translator. Your job is to convert natural language questions into ArcGIS REST API query parameters.

You will receive:
1. A natural language question from the user
2. The available fields for the dataset

You must respond with ONLY a valid JSON object (no markdown, no backticks, no explanation before or after) with these fields:
{
  "where": "SQL WHERE clause for ArcGIS (e.g., STATE='CA' AND BEDS>500)",
  "outFields": "comma-separated list of relevant fields to return",
  "orderByFields": "optional ORDER BY (e.g., BEDS DESC)",
  "resultRecordCount": number between 5-50 (default 20),
  "summary": "A friendly 1-2 sentence summary of what you're searching for"
}

RULES:
- String comparisons in WHERE use single quotes: STATE='CA'
- Use LIKE with % for partial matches: NAME LIKE '%Memorial%'
- State fields typically use 2-letter abbreviations: STATE='TX', ST='CA'
- For yes/no fields like TRAUMA or HELIPAD, use: TRAUMA='LEVEL I' or HELIPAD='Y'
- CAPITAL field uses 'Y' for yes
- Always include NAME and location fields (CITY, STATE or ST) in outFields
- resultRecordCount should match the question scope (specific=5-10, broad=20-50)
- The summary should be human-friendly and describe what will be shown`;
