# Mock Leadership Interview — Hadrian FDE (30 min)

A practice script for the 30-minute leadership round. It's built from the recruiter's notes, the [FDE role description](FDE%20Role%20Description.md), and public candidate reports (see [Sources](#sources)).

**How to use it:** Have someone read the interviewer lines, or run it with Claude, and answer out loud under a timer. Use each answer's target time to practice being concise. Thirty minutes goes quickly, and you want room for your own questions at the end.

---

## What this round is testing

The recruiter's notes point to **product depth**, not coding:

- How you approach a **new product or area** with customers and stakeholders
- **Greenfield** work: gathering requirements and building something for the first time
- Product experience **with design**
- **Working with agents** (AI-native development)
- Knowing **what Hadrian does** and why its mission matters to you
- **Rapport.** It's a conversation, so you're also being evaluated as a future colleague

The role description adds signals they'll likely listen for: **high ownership**, **shipping fast under ambiguity**, **communicating with both factory operators and senior program leaders**, and **turning one-off builds into platform features**.

---

## Suggested timing

| Min     | Segment                           |
| ------- | --------------------------------- |
| 0–3     | Intro and rapport                 |
| 3–7     | Why Hadrian / why FDE             |
| 7–22    | Product depth (2–3 deep dives)    |
| 22–25   | AI and agents                     |
| 25–30   | Your questions for them           |

---

## The script

### 1. Intro and rapport (0–3 min)

> **Interviewer:** "Thanks for making time. To start, walk me through your background and what brought you here."

- **Target:** 90 seconds. Cover your career arc, ending with the thread that leads to Hadrian.
- **Good answer:** Picks 2–3 experiences that map to FDE work (building for customers, going 0→1, ambiguity) instead of listing every job.
- **Tip:** Ask the interviewer one genuine question at some point, such as how long they've been at Hadrian or what they're working on. That builds rapport.

### 2. Why Hadrian, why FDE (3–7 min)

> **Interviewer:** "What do you know about Hadrian, and why do you want to work here?"

- **Target:** 2 minutes. Show you know the company, then make it personal.
- **Hit these points:** the mission (reindustrializing American manufacturing with autonomous factories), the customers (aerospace and defense), and Opus as the software and robotics platform. Then explain why it matters *to you*.
- **Avoid:** Repeating the job posting back to them, or talking only about the funding and valuation.

> **Follow-up:** "This isn't a typical software role. Why forward-deployed instead of a core platform team?"

- **Good answer:** You like being close to the customer, seeing the impact directly, and finding product needs in the field. Mention that FDE builds often become part of Opus.

> **Follow-up:** "What do you think is the hardest part of what Hadrian is trying to do?"

- **Ideas:** Software teams move fast while manufacturing has to be methodical and qualified. Hadrian is scaling to new processes (welding, casting, additive) and new sites at once. Customers' legacy systems are messy. Defense work brings compliance and ITAR constraints.

### 3. Product depth (7–22 min)

This is the core of the round. Prepare **3 stories** using the structure below, then expect them to dig into one or two in detail.

**Story structure, adapted for product work:**
1. **Context:** who the user or customer was, and what was broken or missing
2. **Discovery:** how you figured out what to build (conversations, observation, data)
3. **Decision:** what you chose to build, what you chose *not* to build, and why
4. **Execution:** how fast you shipped and how you iterated
5. **Outcome:** a measurable result and what you'd do differently

> **Q1:** "Tell me about a product you took from zero to one. Start from the very first conversation."

- **Probes to expect:**
  - "Who did you talk to first? How did you know they were the right people?"
  - "What did the customer *ask for* versus what you *actually built*?"
  - "What did you cut from the first version?"
  - "When did you first put it in front of users?"

> **Q2:** "You're dropped into a new customer program. The customer's leadership wants one thing and the operators on the floor want another. What do you do?"

- **Good answer:** Talk to both sides directly. Find the underlying problem each is trying to solve. Make the trade-off visible to the people who can decide. Ship something small that shows progress. Don't just pick a side.
- **Probe:** "How do you explain a technical constraint to a program manager who doesn't care about the tech?"

> **Q3:** "Tell me about a time you worked closely with design, or did the design work yourself."

- **Good answer:** Shows that you care about the user's experience. Examples include watching real users, prototyping low-fidelity first, and changing direction based on feedback.

> **Q4:** "Describe a time the requirements were completely unclear. How did you decide what to build?"

- **Good answer:** You state your assumptions explicitly, build the smallest thing that tests the riskiest one, and get feedback quickly. This is the same skill they test in the Builder round.

> **Q5:** "Tell me about something you built for one customer that ended up being useful more broadly." *(Or: "How do you decide when a one-off should become a platform feature?")*

- **Good answer:** Point to signals such as the same request coming from several customers, the maintenance cost of keeping bespoke versions, and whether the core of the solution is general. You also partner with the platform team instead of forcing your code onto them.

> **Q6:** "Tell me about a project that failed or a decision you got wrong."

- **Good answer:** Real ownership with no blaming, a specific lesson, and evidence that you applied it later.

### 4. AI and agents (22–25 min)

> **Interviewer:** "The role description says AI-native. Show me concretely how AI makes you faster today."

- **Target:** One specific, concrete example, ideally with a before/after on time or scope.
- **Good answer:** Covers your actual workflow: writing specs for agents, setting up verification (tests or checks), reviewing and owning the output, and knowing where the agent fails.
- **Tie it to their language:** Hadrian's MTS description says *"You set the intent, build the verification loop, and then unleash agents… You own what your agents produce."* Show that you already work this way.

> **Follow-up:** "How do you know the code an agent wrote is correct?"

- **Good answer:** Tests, type checks, reading the diff, small increments, and asking the agent to explain its reasoning. You never ship code you can't explain.

### 5. Your questions (25–30 min)

Pick 2–3 questions. Good questions show product thinking and genuine interest.

- "What does a typical FDE program look like in the first 30 days?"
- "Can you share an example of something an FDE built at the edge that became part of Opus?"
- "What makes the difference between an FDE who thrives here and one who struggles?"
- "How do FDEs and the Opus platform teams decide what gets built where?"
- "What's the biggest customer problem you wish you had more people working on right now?"
- "How does the team use AI agents day to day? Has it changed how you scope work?"

---

## Hadrian cheat sheet

The facts below come from the job posting and press coverage. Press figures are self-reported by the company, so phrase them loosely in the interview ("I read that...").

- **Mission:** Build autonomous factories to reindustrialize America. Hadrian combines AI, software, robotics and full-stack manufacturing.
- **Customers:** Aerospace and defense: rockets, satellites, aircraft, ships and submarines. They include the U.S. government, the armed forces and major defense primes.
- **Claim:** Helps customers build up to 10× faster at lower cost.
- **Model:** "Factory-as-a-Service."
- **Software:**
  - **Opus** is the factory software and robotics platform. It translates designs into production steps, schedules jobs, tracks work, and connects production with inspection.
  - **Atlas** reportedly handles supplier procurement.
- **Expansion:** New capabilities in welding, casting, forging, electronics and additive manufacturing (the additive division launched in early 2026).
- **Footprint:** Multiple sites. Press reports Factory 4 in Cherokee, Alabama (opened March 2026, submarine components) and a 7-year Lockheed Martin agreement for a factory in Grand Prairie, Texas (October 2026).
- **Funding:** $1.37B Series D. The posting says the valuation is $7.87B, and press rounds it to about $8B. Investors include a16z, Founders Fund, Lux, Valor, JPMorgan Chase and others.
- **Founder/CEO:** Chris Power, who founded the company in 2020. A theme in his public comments is managing the tension between fast-moving tech talent and methodical manufacturing talent.
- **Hiring model:** All engineering, product and design hires join as a **Member of Technical Staff (MTS)**. In their words: *"Your unit of work is a problem solved, not a ticket or a pull request."*

---

## What candidates report about the process

Public reports are sparse, cover mostly regular software engineering roles, and are mixed. Treat them as hints, not a guide.

- A 2026 software engineer account describes a 45-minute **leadership/behavioral round with an engineering director**, a system design round, and an onsite in Torrance with a **factory tour**, a 30-minute **"partnership" interview about working with non-technical stakeholders**, and a coding round.
- Glassdoor reviews mention take-homes, data structures and algorithms rounds, and behavioral sections. Some candidates found certain conversations "not relevant to the role," and feedback after rejections is inconsistent.
- **Takeaway:** Expect stakeholder and partnership themes to come up more than once in the loop, so make your stakeholder stories strong.

---

## Prep checklist

- [ ] Draft 3 product stories (0→1, stakeholder conflict, ambiguity) using the structure above
- [ ] Prepare 1 failure story
- [ ] Prepare 1 concrete "how AI makes me faster" example
- [ ] Write a 90-second intro
- [ ] Write a 2-minute "why Hadrian" answer that connects the mission to your own story
- [ ] Pick 3 questions to ask
- [ ] Do a full timed run-through out loud

---

## Sources

- [Glassdoor — Hadrian interview questions](https://www.glassdoor.com/Interview/Hadrian-Interview-Questions-E5364733.htm)
- [techinterview.org — How to prep for a Hadrian engineer interview](https://www.techinterview.org/post/3233477824/how-to-prep-hadrian-engineer-interview/)
- [Lux Capital job board — Hadrian Forward Deployed Engineer](https://jobs.luxcapital.com/companies/hadrian/jobs/85441918-forward-deployed-engineer)
- [a16z job board — Director of Engineering, Forward Deployed Engineering](https://jobs.a16z.com/jobs/hadrian/1153f8c7-57ca-49bc-b4ea-b1262aebf255--director-of-engineering-forward-deployed-engineering)
- [Contrary Research — Hadrian report](https://research.contrary.com/reports/hadrian)
- [The Robot Report — Hadrian raises $1.37B](https://www.therobotreport.com/hadrian-raises-1-37b-accelerate-u-s-manufacturing/)
- [3DPrint.com — Hadrian launches additive manufacturing division](https://3dprint.com/323475/factories-as-a-service-startup-hadrian-launches-additive-manufacturing-division/)
- [Hadrian blog — Series C announcement](https://www.hadrian.co/blog/series-c)
- [TechCrunch — Hadrian CEO wants to revitalize American industry](https://techcrunch.com/2024/02/21/hadrian-automations-ceo-wants-to-defy-history-and-revitalize-american-industry)
- [Antoine Buteau — Lessons from Chris Power](https://www.antoinebuteau.com/lessons-from-chris-power/) (secondhand quote compilation, unverified)
- [Sourcery — Chris Power interview](https://www.sourcery.vc/p/exclusive-chris-power-of-hadrian)
