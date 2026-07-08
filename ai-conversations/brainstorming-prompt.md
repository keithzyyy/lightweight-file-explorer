- I have no experience with node.js and UI/UX, but have had prior experience in building R Shiny applications.
- which information from the requirement md fiile should be moved to `AGENTS.md`? E.g. node.js environment
- I am thinking that to proceed with this project, we can translate how my prior experience of developing a feature in end-to-end data science projects can be transferrable: develop code first (e.g. `ipynb` notebook) whilst developing a `.md` specfiication file, move to one or more python modules in `src/`, create a CLI `entrypoint/` to access the feature. I facilitate 30-80% of `src/` implementation, but have fully automated tests (given a test structure in AGENTS.md and a clear test matrix). From the spec, what do we think would be different now?
- As per the below requirements:
```
- Display the files and folders in a **web-based file explorer**
- Allow users to **create folders**
- Allow users to **move files or folders around**
```
- One approach could be that we can define operations associated with the requirements where each operation has an input and expected result/output/side effect that is testable, and subsequently translate each input to an action in the UI. However, since I have little experience in UI and UX, is this the way to go? 
- we need a way to define what done means and define the minimum viable solution. I was thinking about creating MoSCoW? From my experience in building a R shiny application, especially in the front-end part, it is common to start from the skeleton and gradually move to specific features. But in order to do that, we must determine what exactly do we want in each step and what does done look like. 
- we need to determine git commit naming convention
- we need to determine git branch naming convention
- for this project, do we use one giant spec `spec-file-explorer.md` or break it into multiple logical features, each with its own spec but specs may depend on each other?
- provide a simple explanation of node.js. For this project, I was given a hint to use https://nuxt.com/. Navigate to the website and give me a brief overview of what it is. 


