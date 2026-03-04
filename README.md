Description:
Generate screens based on your variables or bind Variables to Text nodes automatically.

How it works:

Select a Section or any sections and run the plugin.

The plugin detects the language from the Section name (e.g. en-US, fr-FR-CA, ar-SA).

It scans frames _01_ to _07_ inside the Section.

For each frame, it finds  Title_var and description_var_1,2,3 and binds them to the matching String Variables.

Expected structure and naming:

Section name contains the language code.

Frame names contain the screenshot index 1..7 (e.g. _01_, _02_).

Inside frame: Title_var and Description_var_1,2,3 (case-insensitive).

Variables organised like this example: https://github.com/aaliev-dev/ScreenshotLocalisationTemplate/blob/main/ScreenshotLocalisationTemplate.json

Keywords: variables, localization, i18n, app store screenshots, play store screenshots, copy, string tokens, automation
