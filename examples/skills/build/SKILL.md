---
name: build
description: "Make a code change from a known cause or a clear spec: test first, in small steps, with proof at the end. Use when the questionnaire names it."
---

# Build

`rules.md` from the questionnaire wins over this skill when they disagree.

1. **Map before you edit.** Find every caller and callee of the code you will change: search the names, and read the code around them. Write down what goes in and what comes out.
2. **Write the test first.** It must fail now, for the reason the task names. Run it and keep the output.
3. **Make the smallest change** that makes the test pass. One function owns each job, and modules talk only through their public API.
4. **Run the test again,** then the tests of every module you touched.
5. **Read your own diff.** Remove what the task does not need: debug prints, renames, and drive-by refactors.
6. **Try to break it:** an empty input, a huge input, a missing file, and running it twice.
7. **Report** what changed, the test output before and after, and anything you could not check.
