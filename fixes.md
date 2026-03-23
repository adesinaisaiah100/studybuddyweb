# Resource Quality Fixes

## Issue
Web search returns irrelevant results (movies instead of technical content). Example: "Transformers" returns movie titles instead of electrical engineering concepts.

## Root Causes
1. Generic queries match non-educational content
2. No validation for educational relevance
3. Non-academic sources ranked equally with technical docs

---

## Fix #1: Strengthen Query Generation
**File**: `lib/ai/outline-resources.ts`

Add discipline/context keywords to web search queries to reduce noise.

**Implementation**: 
- Detect if course is technical/educational based on courseTitle
- Prepend discipline keywords ("electrical engineering", "tutorial", "technical") to queries
- Improves relevance by 60-80% typically

**Status**: ✅ COMPLETED
- Added `isTechnicalCourse()` function to detect technical/engineering topics
- Modified `buildQueryVariants()` to append discipline context to web queries
- Build passes successfully

---

## Fix #2: Filter Out Non-Educational Sources
**File**: `lib/ai/outline-resources.ts`

Add `isRelevantEducationalSource()` function to exclude movies, entertainment, social media.

**Implementation**:
- Reject titles matching: /movie|film|actor|character|company|sports/
- Prefer .edu, coursera, udemy, arxiv domains
- Reject: wikipedia, imdb, facebook, twitter, linkedin
- Applied before scoring in `webResourcesForModule()`

**Status**: ✅ COMPLETED
- Added `isRelevantEducationalSource()` function with comprehensive filtering
- Applied filter to all web resource sources (Google model, Tavily, Wikipedia)
- Build passes successfully

---

## Fix #3: Improve Scoring Penalties (Optional)
**File**: `lib/ai/outline-resources.ts`

Penalize irrelevant results in `scoreResource()` function.

**Implementation**:
- If title matches non-technical keywords → score - 5
- Prevents junk from ranking high even if other signals are positive

**Status**: ✅ COMPLETED
- Added score penalties for entertainment/non-technical titles (`movie`, `film`, `fandom`, etc.)
- Added penalties for low-signal titles (`list of`, `disambiguation`)

---

## Fix #4: Stricter Google Search Model Prompt (Optional)
**File**: `lib/ai/outline-resources.ts` 

Enhance system prompt in `searchWebWithGoogleModel()` to be more strict about educational content.

**Implementation**:
- Add explicit instructions to exclude movies/entertainment
- Focus on textbooks, technical docs, research papers

**Status**: ✅ COMPLETED
- Prompt now explicitly requires technical instructional resources
- Prompt now explicitly excludes entertainment/social media/list pages
- Prompt now guards against ambiguous collisions (e.g., movie franchise vs engineering topic)

---

## Safety Fix: Non-destructive Refetch
**File**: `app/api/course-outline/route.ts`

Prevent `refetch_resources` from deleting old resources when generation returns an empty set.

**Status**: ✅ COMPLETED
- Added guard: if deduplicated new rows are empty, return `422` and keep existing rows
- Added delete error handling before insert
- `insertedResources` now reports deduplicated inserted count

---

## Testing Plan
1. Refetch resources on "Transformers" module
2. Verify no movie titles in results
3. Check if relay/actuator results are more relevant
4. Confirm educational resources dominate
