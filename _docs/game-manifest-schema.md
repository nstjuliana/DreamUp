# Game Manifest Schema

**Version:** 1.0  
**Last Updated:** November 3, 2025

## Overview

The Game Manifest is a structured JSON document that provides the QA agent with game-specific information to improve testing accuracy. Manifests are optional but highly recommended for complex games with non-standard controls or UI patterns.

## Purpose

- Define game type and genre for appropriate testing strategies
- Specify control mappings (keyboard, mouse) for gameplay simulation
- Identify start button location and characteristics
- Document game state sequences (menus, screens, dialogs)
- Provide context for better AI evaluation

## Schema Definition

### TypeScript Interface

```typescript
interface GameManifest {
  version: "1.0";
  name?: string;  // Human-readable manifest name
  
  gameType: "puzzle" | "platformer" | "idle" | "shooter" | "rpg" | "other";
  gameTypeDescription?: string;  // Required if gameType is "other"
  
  controls: ControlsDefinition;
  startButton?: StartButtonConfig;
  gameStates?: GameState[];
  
  loadingDuration?: number;  // Expected loading time in milliseconds
  gameplayDuration?: number;  // Gameplay simulation duration in milliseconds
  gameplayGoal?: string;  // Custom goal for AI gameplay (e.g., "Collect as many coins as possible")
  aiDecisionInterval?: number;  // Milliseconds between AI decisions during gameplay (default 2000ms)
  notes?: string;  // Special instructions or context for the QA agent
}

interface ControlsDefinition {
  primary: string[];      // Primary control keys (e.g., ["ArrowUp", "ArrowDown", "Space"])
  secondary?: string[];   // Alternative controls (e.g., ["KeyW", "KeyA", "KeyS", "KeyD"])
  mouse?: boolean;        // Whether game uses mouse input
  mouseActions?: ("click" | "drag" | "scroll")[];  // Specific mouse actions used
}

interface StartButtonConfig {
  selector?: string;      // CSS selector for start button (e.g., "#start-btn")
  text?: string;          // Text content of start button (e.g., "Start Game", "Play")
  position?: "center" | "top" | "bottom" | "left" | "right";
  waitAfterClick?: number; // Milliseconds to wait after clicking start button
}

interface GameState {
  name: string;              // Human-readable name (e.g., "Enter Player Name", "Main Menu")
  order: number;             // Sequence order (0-based)
  expectedElements?: ExpectedElement[];
  requiredActions?: RequiredAction[];
  screenshotUrl?: string;    // Optional: reference screenshot of this state
}

interface ExpectedElement {
  type: "input" | "button" | "text" | "canvas" | "dialog";
  selector?: string;         // CSS selector if known
  text?: string;             // Expected text content
  description?: string;      // Human description for AI agent
}

interface RequiredAction {
  action: "type" | "click" | "press" | "wait" | "select";
  target?: string;           // Element selector, key name, or dropdown option
  value?: string;            // For "type" or "select" actions
  waitMs?: number;           // For "wait" action
  description?: string;      // Human description of what this action does
}
```

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GameManifest",
  "type": "object",
  "required": ["version", "gameType", "controls"],
  "properties": {
    "version": {
      "type": "string",
      "enum": ["1.0"]
    },
    "name": {
      "type": "string",
      "description": "Human-readable manifest name"
    },
    "gameType": {
      "type": "string",
      "enum": ["puzzle", "platformer", "idle", "shooter", "rpg", "other"]
    },
    "gameTypeDescription": {
      "type": "string",
      "description": "Required if gameType is 'other'"
    },
    "controls": {
      "type": "object",
      "required": ["primary"],
      "properties": {
        "primary": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1
        },
        "secondary": {
          "type": "array",
          "items": { "type": "string" }
        },
        "mouse": { "type": "boolean" },
        "mouseActions": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["click", "drag", "scroll"]
          }
        }
      }
    },
    "startButton": {
      "type": "object",
      "properties": {
        "selector": { "type": "string" },
        "text": { "type": "string" },
        "position": {
          "type": "string",
          "enum": ["center", "top", "bottom", "left", "right"]
        },
        "waitAfterClick": { "type": "number" }
      }
    },
    "gameStates": {
      "type": "array",
      "items": { "$ref": "#/definitions/GameState" }
    },
    "loadingDuration": { "type": "number" },
    "notes": { "type": "string" }
  },
  "definitions": {
    "GameState": {
      "type": "object",
      "required": ["name", "order"],
      "properties": {
        "name": { "type": "string" },
        "order": { "type": "number" },
        "expectedElements": {
          "type": "array",
          "items": { "$ref": "#/definitions/ExpectedElement" }
        },
        "requiredActions": {
          "type": "array",
          "items": { "$ref": "#/definitions/RequiredAction" }
        },
        "screenshotUrl": { "type": "string" }
      }
    },
    "ExpectedElement": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["input", "button", "text", "canvas", "dialog"]
        },
        "selector": { "type": "string" },
        "text": { "type": "string" },
        "description": { "type": "string" }
      }
    },
    "RequiredAction": {
      "type": "object",
      "required": ["action"],
      "properties": {
        "action": {
          "type": "string",
          "enum": ["type", "click", "press", "wait", "select"]
        },
        "target": { "type": "string" },
        "value": { "type": "string" },
        "waitMs": { "type": "number" },
        "description": { "type": "string" }
      }
    }
  }
}
```

## Example Manifests

### Simple Puzzle Game (Tic-Tac-Toe)

```json
{
  "version": "1.0",
  "name": "Tic-Tac-Toe Standard Controls",
  "gameType": "puzzle",
  "controls": {
    "primary": [],
    "mouse": true,
    "mouseActions": ["click"]
  },
  "startButton": {
    "text": "Start Game",
    "position": "center"
  },
  "gameStates": [
    {
      "name": "Main Menu",
      "order": 0,
      "expectedElements": [
        {
          "type": "button",
          "text": "Start Game"
        }
      ],
      "requiredActions": [
        {
          "action": "click",
          "target": "button[text='Start Game']",
          "description": "Click start button to begin game"
        }
      ]
    },
    {
      "name": "Game Board",
      "order": 1,
      "expectedElements": [
        {
          "type": "canvas",
          "description": "3x3 game grid"
        }
      ],
      "requiredActions": [
        {
          "action": "click",
          "description": "Click cells on the grid to play"
        }
      ]
    }
  ],
  "notes": "Simple mouse-only game. AI should click on grid cells."
}
```

### Platformer Game

```json
{
  "version": "1.0",
  "name": "Platformer with Arrow Keys",
  "gameType": "platformer",
  "controls": {
    "primary": ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"],
    "secondary": ["KeyA", "KeyD", "KeyW"],
    "mouse": false
  },
  "startButton": {
    "selector": "#play-button",
    "text": "Play",
    "position": "center",
    "waitAfterClick": 2000
  },
  "gameStates": [
    {
      "name": "Main Menu",
      "order": 0,
      "expectedElements": [
        {
          "type": "button",
          "selector": "#play-button",
          "text": "Play"
        }
      ]
    },
    {
      "name": "Character Selection",
      "order": 1,
      "expectedElements": [
        {
          "type": "dialog",
          "description": "Character selection dialog"
        }
      ],
      "requiredActions": [
        {
          "action": "click",
          "target": ".character-card:first-child",
          "description": "Select first character"
        },
        {
          "action": "click",
          "target": "#confirm-button",
          "description": "Confirm selection"
        }
      ]
    },
    {
      "name": "Gameplay",
      "order": 2,
      "expectedElements": [
        {
          "type": "canvas",
          "description": "Game canvas with platformer level"
        }
      ],
      "requiredActions": [
        {
          "action": "press",
          "target": "ArrowRight",
          "description": "Move right"
        },
        {
          "action": "press",
          "target": "Space",
          "description": "Jump"
        }
      ]
    }
  ],
  "loadingDuration": 3000,
  "gameplayDuration": 60000,
  "gameplayGoal": "Progress as far as possible through the level while collecting coins",
  "aiDecisionInterval": 2000,
  "notes": "Wait 2 seconds after clicking play button. Character selection screen appears before gameplay."
}
```

### Idle/Clicker Game

```json
{
  "version": "1.0",
  "name": "Cookie Clicker Style",
  "gameType": "idle",
  "controls": {
    "primary": [],
    "mouse": true,
    "mouseActions": ["click"]
  },
  "startButton": {
    "selector": "#cookie",
    "position": "center"
  },
  "gameStates": [
    {
      "name": "Main Game Screen",
      "order": 0,
      "expectedElements": [
        {
          "type": "button",
          "selector": "#cookie",
          "description": "Main clickable element"
        },
        {
          "type": "text",
          "description": "Score counter"
        }
      ],
      "requiredActions": [
        {
          "action": "click",
          "target": "#cookie",
          "description": "Click cookie repeatedly"
        }
      ]
    }
  ],
  "gameplayDuration": 30000,
  "gameplayGoal": "Click the cookie as many times as possible to maximize score",
  "aiDecisionInterval": 1000,
  "notes": "No explicit start button - game starts immediately. Main interaction is clicking the cookie."
}
```

### RPG with Complex State Flow

```json
{
  "version": "1.0",
  "name": "Text RPG with Player Name Entry",
  "gameType": "rpg",
  "controls": {
    "primary": ["Enter"],
    "mouse": true,
    "mouseActions": ["click"]
  },
  "startButton": {
    "text": "Start Adventure",
    "position": "center"
  },
  "gameStates": [
    {
      "name": "Title Screen",
      "order": 0,
      "expectedElements": [
        {
          "type": "button",
          "text": "Start Adventure"
        }
      ],
      "requiredActions": [
        {
          "action": "click",
          "target": "button[text='Start Adventure']"
        }
      ]
    },
    {
      "name": "Enter Player Name",
      "order": 1,
      "expectedElements": [
        {
          "type": "input",
          "selector": "#player-name-input",
          "description": "Text input for player name"
        }
      ],
      "requiredActions": [
        {
          "action": "type",
          "target": "#player-name-input",
          "value": "TestPlayer",
          "description": "Enter player name"
        },
        {
          "action": "click",
          "target": "#confirm-name-button",
          "description": "Confirm name entry"
        }
      ]
    },
    {
      "name": "Class Selection",
      "order": 2,
      "expectedElements": [
        {
          "type": "dialog",
          "description": "Class selection dialog"
        }
      ],
      "requiredActions": [
        {
          "action": "click",
          "target": ".class-option:first-child",
          "description": "Select first class"
        }
      ]
    },
    {
      "name": "Gameplay",
      "order": 3,
      "expectedElements": [
        {
          "type": "canvas",
          "description": "Game world canvas"
        }
      ]
    }
  ],
  "loadingDuration": 5000,
  "notes": "Complex state flow: Title → Name Entry → Class Selection → Gameplay. Must enter player name before proceeding."
}
```

## Key Concepts

### Control Key Names

Use standard JavaScript KeyboardEvent key values:
- **Arrow Keys**: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- **Letter Keys**: `KeyA`, `KeyB`, `KeyC`, etc.
- **Special Keys**: `Space`, `Enter`, `Escape`, `Tab`
- **Number Keys**: `Digit0`, `Digit1`, etc.

See [MDN KeyboardEvent.key documentation](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) for complete list.

### Game Types

- **puzzle**: Logic/strategy games with minimal real-time action (tic-tac-toe, sudoku, match-3)
- **platformer**: Side-scrolling or platforming games requiring movement and jumping
- **idle**: Clicker/idle games with minimal player input
- **shooter**: Action games requiring aim and shooting
- **rpg**: Role-playing games with character progression and story
- **other**: Any game not fitting above categories (specify in `gameTypeDescription`)

### CSS Selectors

For `selector` fields, use standard CSS selector syntax:
- ID: `#my-button`
- Class: `.button-class`
- Attribute: `button[type="submit"]`
- Text content: `button:contains("Start")`
- Nth child: `.item:first-child`, `.item:nth-child(2)`

### Game States vs Screens

Game states represent distinct phases in the game flow:
- **Menu states**: Title screen, main menu, pause menu
- **Input states**: Name entry, settings configuration
- **Selection states**: Character/class selection, level selection
- **Gameplay states**: Actual gameplay, different levels/stages
- **End states**: Game over, victory screen

### AI Gameplay Configuration

The QA agent uses AI to intelligently play games during testing. Two optional fields control this behavior:

**`gameplayGoal`** (string, optional):
- Custom objective for the AI to pursue during gameplay
- Examples: "Collect as many coins as possible", "Reach the highest level", "Survive as long as possible"
- Default (if not specified): "Keep playing as long as possible without dying or losing"
- The AI uses this goal to make strategic decisions about which actions to take

**`aiDecisionInterval`** (number, optional):
- Milliseconds between AI decision cycles during gameplay
- Default: 2000ms (2 seconds)
- Lower values = more frequent AI decisions (slower, more costly, but potentially more intelligent)
- Higher values = less frequent AI decisions (faster, cheaper, but potentially less responsive)
- The AI will observe the game state and make a decision at each interval

**Example:**
```json
{
  "gameplayGoal": "Collect as many points as possible while avoiding obstacles",
  "aiDecisionInterval": 1500
}
```

## Usage in QA Agent

The QA agent uses manifests to:

1. **Select Interaction Strategy**: Different strategies for different game types
2. **Locate Start Button**: Use selector, text, or position to find start button
3. **Navigate Game States**: Follow the sequence defined in `gameStates`
4. **Simulate Controls**: Press keys/click as defined in `controls`
5. **Handle Special Cases**: Apply game-specific logic from `notes`

## Manifest Versioning

Games can have multiple manifest versions to handle:
- Game updates that change controls or UI
- Discovery of additional game states after initial testing
- Refinement of selectors and actions for better accuracy
- Different testing strategies (thorough vs quick test)

Each test run records which manifest version was used for reproducibility.

## Best Practices

1. **Start Simple**: Begin with minimal manifest (game type + basic controls)
2. **Iterate**: Add game states as you discover them through testing
3. **Use Descriptive Names**: Version names like "v2.0 - After December Update"
4. **Document Changes**: Use `notes` field in manifest to explain what changed
5. **Test Both Ways**: Run tests with and without manifest to validate improvements
6. **CSS Selectors**: Use stable selectors (IDs) rather than fragile ones (complex class chains)

## Validation

Manifests are validated on save:
- Required fields must be present (`version`, `gameType`, `controls`)
- Game type must be valid enum value
- Control keys must be valid KeyboardEvent key values
- If `gameType` is "other", `gameTypeDescription` is required
- Game states must have unique `order` values
- CSS selectors (if provided) must be valid syntax

## Future Extensions

Potential additions to manifest schema in future versions:
- Accessibility metadata (ARIA labels, screen reader support)
- Performance expectations (expected FPS, load time)
- Network requirements (online-only, offline-capable)
- Save/persistence information (localStorage, cookies)
- Multiplayer configuration (if supported later)

---

**Note**: This schema is designed to be human-readable and AI-friendly. The QA agent uses this information to guide its testing strategy, but it also applies heuristics and AI-powered detection when manifest information is incomplete or unavailable.

