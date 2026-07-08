# Internship Take-Home Task: Web-Based File Explorer

## Goal

Build a **Node.js web app** that works as a lightweight file explorer for documents.

You will be given a flat list of Markdown files. Your app should organise them into a useful file/folder structure, display them in a web UI, and allow users to interact with the structure.

We are not expecting a perfect production system. We are looking for how you think, design, build, and communicate.

---

## Given Files

```text
310-ARCHITECTURE.md
310-gov-high-level-spec.md
311-100-epic-epic-a.md
311-110-feature-feature-a.md
311-111-story-story-a.md
311-112-story-story-b.md
312-100-epic-epic-b.md
312-110-feature-feature-a.md
312-111-story-story-a.md
312-120-feature-feature-b.md
```

---

## Expected Minimum File Explorer Structure

Your app should at least be able to represent something like:

```text
300-product/
└── 310-product-a/
    ├── 310-governance/
    │   ├── 310-ARCHITECTURE.md
    │   └── 310-gov-high-level-spec.md
    ├── 311-epic-a/
    │   ├── 311-100-epic-epic-a.md
    │   ├── 311-110-feature-feature-a.md
    │   ├── 311-111-story-story-a.md
    │   └── 311-112-story-story-b.md
    └── 312-epic-b/
        ├── 312-100-epic-epic-b.md
        ├── 312-110-feature-feature-a.md
        ├── 312-111-story-story-a.md
        └── 312-120-feature-feature-b.md
```

You may decide how this structure is generated, stored, edited, and displayed.

---

## Core Requirements

Your project should:

- Use a **Node.js environment**
- Be pushed to a **GitHub repository**
- Persist changes
- Have a clear and usable UI
- Include clear instructions so we can run it locally
- Display the files and folders in a **web-based file explorer**
- Allow users to **create folders**
- Allow users to **move files or folders around**

Do not email files directly. We will only review GitHub repositories.

---

## Creative Freedom

You are encouraged to add features you think are useful. We are interested in your product sense as much as your code.

---

## AI Usage

You are encouraged to use AI coding tools while completing this task.

Please include a short `AI_USAGE.md` file describing:

- Which AI tools you used
- What you used them for
- What parts you wrote or changed yourself
- Any important prompts or conversation history you are comfortable sharing
- How you reviewed, tested, or corrected AI-generated work

Using AI is not a negative. We want to see how well you use it, verify it, and improve on it.

---

## Submission

Submit a GitHub repository containing:

- Source code
- `README.md` with local setup instructions
- Any database, schema, or setup notes
- `AI_USAGE.md`
- Optional deployment link, if available

A reviewer should be able to clone the repo and run the app without guessing.

---

## What We Are Looking For

We will review your work based on:

- Meticulousness and attention to detail
- UI/UX design
- Data structure and Database/persistence design
- Architecture and code organisation
- Practical AI usage
- Git
