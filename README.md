# Hadrian Interview Prep — Forward Deployed Engineer

Prep notes for the Hadrian FDE interview loop. See [FDE Role Description.md](FDE%20Role%20Description.md) for the full job posting and [Leadership Mock Interview.md](Leadership%20Mock%20Interview.md) for a practice script. For the builder round, see [Builder Mock Interview.md](Builder%20Mock%20Interview.md).

## Schedule

| Date            | Time (PST)       | Interview                |
| --------------- | ---------------- | ------------------------ |
| Monday, Nov 23  | 10:00 – 10:30 AM | Leadership               |
| Tuesday, Nov 24 | 10:00 – 11:00 AM | Builder Interview Part 1 |

## Recruiter Notes

- **Technical:** Work as a team player.
- **Leadership:** Focus on product depth:
  - How you approach a new product and area with customers and stakeholders
  - Product experience with design
  - Greenfield work: gathering requirements and building something for the first time
  - Working with agents
- **Know Hadrian:** What the company does, its mission, and the high-level vision. The CEO's goal is to rebuild American manufacturing with automated factories.

## Leadership Interview (30 min, Microsoft Teams)

Discussion of your product sense and how you develop products.

- Explain what interests you about working at Hadrian
- Build rapport with the interviewer
- Be ready to discuss projects you've worked on

## Builder Interview Part 1 (60 min, Microsoft Teams)

You'll use AI to research and work through a real problem alongside a Hadrian engineer. They present a need or gap in the product, and together you decide what to build and how to approach it. The full hour is collaborative, so treat the interviewer as a partner: ask questions, verify assumptions, and talk through your reasoning.

### What they're evaluating

How you specify what you want and direct the work:

- Translating a product need into a clear, well-structured spec
- Specifying precisely enough to direct an agent
- Making trade-offs under ambiguity
- Leveraging AI to produce production-grade work

### The problem chain

Most builder problems fit this chain. Ask one question for each box and each arrow, and fill in a skeleton `SPEC.md` as the answers come in.

```
WHO creates input → INPUT (shape?) → CHECK/TRANSFORM (rules?) → OUTPUT (shape?) → WHO acts on it → WHEN
                                              ↑                         ↓
                                     who maintains rules?      what if it's wrong? (exceptions, false alarms)
```

- **Start with a quick first pass:** "I understand things best by working an example. Let me trace this one by hand for a minute."
- **Ask what makes it hard:** "What makes this harder than it looks?" and "Why hasn't this been automated already?"
- **Play it back** before writing the spec: "So X creates Y, we check it against Z, and W acts on the result at time T. Right?"

Example from the routing-validation mock ([Builder Mock Interview.md](Builder%20Mock%20Interview.md)):

```
ME (15, not programmers) → routing JSON (a graph, not a list) → check against customer's rules
   → violations list → QE (fix, or override with an auditable reason) → at release time
   rules: per customer, will keep growing    |    false positives are what kill adoption
```

### Logistics

- **Language:** Any. Use whichever you know best.
- **Setup:** Your own laptop and preferred tools. Hadrian provides a disposable, spend-limited Claude Code API key (shared securely), so use it freely.
- **Restrictions:** Don't use any code, documents, tools, or accounts belonging to a current or former employer, and don't enter confidential information into the AI session.

### After the session

1. Upload your work (spec, prototype, code, and/or agent chat logs, as directed by the interviewer) to the provided Box link.
2. Name the file `LastName_FirstName_Builder_Part1.zip` (e.g. `Smith_Jane_Builder_Part1.zip`).
3. If you move forward, you'll get emailed instructions to continue the work with an agent. Submit the final work to Box **at least 48 hours before the onsite**.

## Reported Interview Questions (Glassdoor)

### Technical / system design

- **Schema migration:** Given a SQL Server database with a fixed schema backing a CNC tooling application, design a migration to Postgres that supports new tooling definitions with differing schemas.
- **Knight's shortest path:** On an m × n chessboard with a knight at some position, find the length of the shortest path to a target, the path itself, and all shortest paths.
- **JSON parser:** For a simplified JSON format with only integers, strings, arrays, and objects:
  1. Define the type of a parsed JSON value.
  2. Write a parser that turns strings into values of this type.
- **Concurrent graph traversal:** Determine the total time to traverse an entire graph when concurrent paths can be taken.
- **Process validation:** Verify a process represented as a directed graph, where certain step types must happen before others and a required number of each step type must exist.

### Behavioral / project

- Tell me about your most exciting project.
- How would you add extra features to the take-home project?

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
