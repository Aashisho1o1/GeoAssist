import type { Dataset, Example } from "../types";

// Pre-translated example queries, so the demo works without an API key.
function example(question: string, where: string, outFields: string, orderByFields: string, summary: string): Example {
  return { question, query: { where, outFields, orderByFields, resultRecordCount: 20, summary } };
}

export const DATASETS: Dataset[] = [
  {
    id: "hospitals",
    name: "US Hospitals",
    label: "Hospitals",
    description: "7,500+ hospitals across the United States",
    impact: "Find healthcare near you or research medical access equity",
    url: "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/Hospitals_hifld/FeatureServer/0",
    fields: [
      "NAME", "ADDRESS", "CITY", "STATE", "ZIP", "TELEPHONE", "TYPE",
      "STATUS", "POPULATION", "COUNTY", "COUNTYFIPS", "COUNTRY",
      "LATITUDE", "LONGITUDE", "NAICS_CODE", "NAICS_DESC", "SOURCE",
      "SOURCEDATE", "VAL_METHOD", "VAL_DATE", "WEBSITE", "STATE_ID",
      "ALT_NAME", "ST_FIPS", "OWNER", "TTL_STAFF", "BEDS", "TRAUMA", "HELIPAD",
    ],
    examples: [
      example("Show hospitals in California with more than 500 beds", "STATE='CA' AND BEDS>500",
        "NAME,CITY,STATE,BEDS,TRAUMA", "BEDS DESC", "California hospitals with more than 500 beds, largest first."),
      example("Find trauma centers in Texas", "STATE='TX' AND TRAUMA NOT IN ('NOT AVAILABLE','NON-DESIGNATED','NOT DESIGNATED','UNCLASSIFIED')",
        "NAME,CITY,STATE,TRAUMA,BEDS", "BEDS DESC", "Designated trauma centers (any level) in Texas."),
      example("Which hospitals have helipads in Florida?", "STATE='FL' AND HELIPAD='Y'",
        "NAME,CITY,STATE,HELIPAD,BEDS", "BEDS DESC", "Florida hospitals with a helipad."),
      example("Show me government-owned hospitals in New York", "STATE='NY' AND OWNER LIKE 'GOVERNMENT%'",
        "NAME,CITY,STATE,OWNER,BEDS", "BEDS DESC", "Federal, state and local government hospitals in New York."),
    ],
    valueHints: [
      "STATE is a 2-letter code: STATE='TX'",
      "TRAUMA is free text. Any trauma center: TRAUMA NOT IN ('NOT AVAILABLE','NON-DESIGNATED','NOT DESIGNATED','UNCLASSIFIED'). Level I: (TRAUMA IN ('I','1','LEVEL I','LEVEL 1') OR TRAUMA LIKE 'LEVEL I,%' OR TRAUMA LIKE 'LEVEL I %' OR TRAUMA LIKE 'I,%')",
      "HELIPAD: 'Y' or 'N'",
      "OWNER: 'GOVERNMENT - FEDERAL', 'GOVERNMENT - STATE', 'GOVERNMENT - LOCAL', 'GOVERNMENT - DISTRICT/AUTHORITY', 'NON-PROFIT', 'PROPRIETARY'",
      "TYPE: 'GENERAL ACUTE CARE', 'CRITICAL ACCESS', 'CHILDREN', 'PSYCHIATRIC', 'MILITARY', 'LONG TERM CARE', 'REHABILITATION', 'WOMEN', 'SPECIAL', 'CHRONIC DISEASE'",
      "STATUS: 'OPEN' or 'CLOSED'",
      "BEDS = -999 means unknown",
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
    url: "https://services1.arcgis.com/cRvLdSPAsRupRo7I/arcgis/rest/services/Public_Schools_/FeatureServer/0",
    fields: [
      "NAME", "ADDRESS", "CITY", "STATE", "ZIP", "TELEPHONE", "TYPE",
      "STATUS", "POPULATION", "COUNTY", "COUNTYFIPS", "COUNTRY",
      "LATITUDE", "LONGITUDE", "NAICS_CODE", "NAICS_DESC", "SOURCE",
      "SOURCEDATE", "VAL_METHOD", "VAL_DATE", "WEBSITE", "LEVEL_",
      "ENROLLMENT", "ST_GRADE", "END_GRADE", "FT_TEACHER", "SHELTER_ID",
    ],
    examples: [
      example("Show high schools in Los Angeles County", "STATE='CA' AND COUNTY='LOS ANGELES' AND LEVEL_='HIGH'",
        "NAME,CITY,STATE,LEVEL_,ENROLLMENT", "ENROLLMENT DESC", "High schools in Los Angeles County, largest first."),
      example("Find schools with enrollment over 2000 students", "ENROLLMENT>2000",
        "NAME,CITY,STATE,LEVEL_,ENROLLMENT", "ENROLLMENT DESC", "US public schools with more than 2,000 students."),
      example("Which schools in Ohio have more than 100 teachers?", "STATE='OH' AND FT_TEACHER>100",
        "NAME,CITY,STATE,FT_TEACHER,ENROLLMENT", "FT_TEACHER DESC", "Ohio schools with more than 100 full-time teachers."),
      example("Show me elementary schools in Claremont, California", "STATE='CA' AND CITY='CLAREMONT' AND LEVEL_='ELEMENTARY'",
        "NAME,CITY,STATE,LEVEL_,ENROLLMENT", "NAME ASC", "Elementary schools in Claremont, California."),
    ],
    valueHints: [
      "STATE is a 2-letter code: STATE='OH'",
      "COUNTY and CITY are uppercase: COUNTY='LOS ANGELES', CITY='MIAMI'",
      "LEVEL_: 'ELEMENTARY', 'MIDDLE', 'HIGH', 'SECONDARY', 'PREKINDERGARTEN', 'ADULT EDUCATION', 'UNGRADED', 'OTHER'",
      "TYPE and STATUS are numeric codes; do not filter on them",
      "ENROLLMENT and FT_TEACHER use -999 for unknown",
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
      "OBJECTID", "NAME", "CLASS", "STATE_ABBR", "STATE_FIPS", "PLACE_FIPS",
      "POPULATION", "POP_CLASS", "POP_SQMI", "SQMI", "CAPITAL"
    ],
    examples: [
      example("Show cities in California with population over 500000", "STATE_ABBR='CA' AND POPULATION>500000",
        "NAME,STATE_ABBR,POPULATION", "POPULATION DESC", "California cities with more than 500,000 people."),
      example("Which state capitals have the highest population?", "CAPITAL='State'",
        "NAME,STATE_ABBR,POPULATION,CAPITAL", "POPULATION DESC", "US state capitals, most populous first."),
      example("Show me cities in Texas with population over 250000", "STATE_ABBR='TX' AND POPULATION>250000",
        "NAME,STATE_ABBR,POPULATION", "POPULATION DESC", "Texas cities with more than 250,000 people."),
      example("Find large cities in Florida", "STATE_ABBR='FL' AND POPULATION>200000",
        "NAME,STATE_ABBR,POPULATION", "POPULATION DESC", "Florida cities with more than 200,000 people."),
    ],
    valueHints: [
      "STATE_ABBR is a 2-letter code: STATE_ABBR='CA'",
      "CAPITAL: 'State' for state capitals, 'National' for Washington DC, '' otherwise",
      "CLASS: 'city', 'town', 'village', 'borough', 'municipality', 'Census Designated Place'",
      "POP_CLASS is a numeric size bucket; prefer POPULATION for size filters",
    ],
    icon: "urban-model",
    color: "#2ecc71",
  },
];

export const LLM_SYSTEM_PROMPT = `You are a GIS query translator. Convert a natural language question into ArcGIS REST API query parameters.

You will receive the dataset name, its fields, notes on the values those fields hold, and the user's question.

Fill these fields:
- where: SQL WHERE clause for ArcGIS (e.g., STATE='CA' AND BEDS>500). Use 1=1 when there is no filter.
- outFields: comma-separated list of fields to return
- orderByFields: ORDER BY clause (e.g., BEDS DESC), or an empty string
- resultRecordCount: integer from 5 to 50; 5-10 for specific questions, 20-50 for broad ones
- summary: a friendly 1-2 sentence description of what will be shown

RULES:
- Use only the listed field names, in WHERE, outFields and orderByFields alike
- Follow the value notes exactly; values are case-sensitive
- String comparisons use single quotes: STATE='CA'
- Use LIKE with % for partial matches: NAME LIKE '%MEMORIAL%'
- Plain SQL only: no semicolons, comments or subqueries
- Always include NAME and the location fields (CITY, STATE or STATE_ABBR) in outFields`;
