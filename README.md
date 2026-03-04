# Bind-variables-to-text-nodes (Figma Plugin)

Generate and bind localized store screenshots from Figma Variables, without playing “hunt the text layer” for every language.

This plugin helps you do two things:

Bind variables to screenshot frames (one or many Sections at once)

Generate missing locale Sections by cloning a template Section and binding variables automatically

## Features

One-click binding: Select one or multiple language Sections and press Bind

Generate missing locales: Create Sections for locales that exist in Variables but don’t exist in your file yet

Supports up to 7 screenshots per locale (frames 01..07)

Up to 3 description lines per screenshot

RTL support: Arabic/Hebrew locales get right-aligned text

Works with Variables JSON imports (Design Tokens Format Module 2025.10, via tools like Variables JSON Import)

Single global log panel placed next to the parent Screens Section, with a detailed list of bindings

## How it works
### Bind mode

Select one or multiple Sections (or any nodes inside them).

Run the plugin and click Bind.

For each selected Section, the plugin:

Detects the locale from the Section name (example: en-US, fr-FR-CA, ar-SA)

Scans frames 01 to 07 inside the Section

Finds text nodes (case-insensitive):

Title_var

Description_var (optional)

Description_var_1, Description_var_2, Description_var_3 (optional)

Binds the nodes to matching String Variables

### Generate missing locales

Select a template locale Section (and optionally other locale Sections).

Run the plugin and click Generate missing locales.

The plugin:

Uses the first selected Section as a template

Detects which locale keys exist in Variables

Detects which locale Sections already exist alongside the template (same parent)

Clones the template for each missing locale, renames it to the locale key, and binds variables

## Expected structure and naming
### Sections

Section name must contain the locale key, e.g.:

en-US

fr-FR-CA

ar-SA

The match is substring-based (so Screens — fr-FR-CA also works).

### Frames (screenshots)

Frames must contain screenshot index 1..7 in the name, e.g.:

_01_

01

Screenshot 02

_07_

The plugin reads the first number it finds and maps it to screenshot_01..screenshot_07.

### Text layers inside each frame

Case-insensitive:

Title_var

Description_var (treated as description line 1)

Description_var_1 (description line 1)

Description_var_2 (description line 2)

Description_var_3 (description line 3)

If a layer exists and the variable exists, it binds.
If one side is missing, the plugin skips and moves on.

## Variable naming convention

Variables must be String variables and use slash-separated naming. The plugin expects the last segments to look like:

<locale_key>/screenshot_01/title
<locale_key>/screenshot_01/description_1
<locale_key>/screenshot_01/description_2
<locale_key>/screenshot_01/description_3

Supported description field formats:

description_1, description_2, description_3

description_01, description_02, description_03

description (legacy, treated as description_1)

Example JSON (Design Tokens Format Module 2025.10):
https://github.com/aaliev-dev/ScreenshotLocalisationTemplate/blob/main/ScreenshotLocalisationTemplate.json

## RTL support

For locales starting with:

ar (Arabic)

he (Hebrew)

…the plugin sets textAlignHorizontal = RIGHT for Title and all bound descriptions.

## Logging

If logging is enabled, the plugin creates one global log panel:

Placed to the left of the lowest common parent Section that contains all selected locale Sections (e.g. Screenshots)

Contains:

Summary per locale

Full list of bindings (Section / Frame / Layer -> Variable)

Warnings (missing layers, missing variables, locked nodes, instances)

Errors (font-loading issues, binding failures)

## Common issues and fixes

Nothing binds

Check that your Section name actually contains the locale key used in Variables

Check frame names contain 01..07

Check layer names match Title_var / Description_var_*

Binding fails due to fonts

Some Figma operations require fonts to be loaded; the plugin attempts to load fonts automatically and retries

Nodes inside instances

Figma does not allow editing instance contents directly; detach instance or move text layers out

## Keywords

variables, localization, i18n, app store screenshots, play store screenshots, copy, string tokens, automation
