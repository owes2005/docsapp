# DocsApp

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.3.11.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Backend Integration Note: Block Content Stores HTML

The `content` field in page blocks stores HTML markup, not plain text.

Example:

```json
{
  "id": "block1",
  "type": "text",
  "content": "This is <strong>bold</strong>, <em>italic</em>, and <u>underlined</u> text.",
  "order": 0
}
```

Common tags you may receive:

- `<strong>` for bold
- `<em>` for italic
- `<u>` for underline
- `<s>` for strikethrough
- `<a href=\"...\">` for links
- `<span style=\"color: ...\">` for text color
- `<span style=\"background-color: ...\">` for highlight
- `<code>` for inline code

Storage guidance:

- SQL: store as `TEXT` / `VARCHAR`
- MongoDB: store as `string`
- Recommended max size: ~100KB per block

Security:

- Frontend rendering already goes through Angular sanitization on `[innerHTML]`.
- Backend can store the HTML string payload as-is.
