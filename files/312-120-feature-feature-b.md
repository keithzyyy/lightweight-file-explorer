# Feature B

## Summary

Feature B for Epic B covers moving folders and preserving hierarchy changes.

## User Value

Users can refine the generated structure as their understanding of the documents changes.

## Acceptance Criteria

- Users can move a folder into another valid folder.
- The app prevents moving a folder into itself or one of its descendants.
- Folder moves persist after refresh.

## Implementation Note

The persistence model should store stable identifiers or paths so move operations are predictable.
