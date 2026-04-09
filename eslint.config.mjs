import globals from "globals";
import pluginJs from "@eslint/js";
import stylisticJs from '@stylistic/eslint-plugin-js';
import jsdoc from 'eslint-plugin-jsdoc';

/** @type {import('eslint').Linter.Config[]} */
export default [
    { files: ["**/*.js"], languageOptions: { sourceType: "module" } },
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    jsdoc.configs['flat/recommended'], // Add JSDoc recommended configuration
    {
        plugins: {
            '@stylistic/js': stylisticJs,
            jsdoc // Add jsdoc plugin
        },
        rules: {
            // Existing stylistic and core rules
            "@stylistic/js/semi": ["error", "always"],
            "no-var": ["error"],
            "no-new-func": ["error"],
            "constructor-super": ["error"],
            "for-direction": ["error"],
            "getter-return": ["error"],
            "no-async-promise-executor": ["error"],
            "no-case-declarations": ["error"],
            "no-class-assign": ["error"],
            "no-compare-neg-zero": ["error"],
            "no-cond-assign": ["error"],
            "no-const-assign": ["error"],
            "no-constant-binary-expression": ["error"],
            "no-constant-condition": ["error"],
            "no-control-regex": ["error"],
            "no-debugger": ["error"],
            "no-delete-var": ["error"],
            "no-dupe-args": ["error"],
            "no-dupe-class-members": ["error"],
            "no-dupe-else-if": ["error"],
            "no-dupe-keys": ["error"],
            "no-duplicate-case": ["error"],
            "no-empty": ["error"],
            "no-empty-character-class": ["error"],
            "no-empty-pattern": ["error"],
            "no-empty-static-block": ["error"],
            "no-ex-assign": ["error"],
            "no-extra-boolean-cast": ["error"],
            "no-fallthrough": ["error"],
            "no-func-assign": ["error"],
            "no-global-assign": ["error"],
            "no-import-assign": ["error"],
            "no-invalid-regexp": ["error"],
            "no-irregular-whitespace": ["error"],
            "no-loss-of-precision": ["error"],
            "no-misleading-character-class": ["error"],
            "no-new-native-nonconstructor": ["error"],
            "no-nonoctal-decimal-escape": ["error"],
            "no-obj-calls": ["error"],
            "no-octal": ["error"],
            "no-prototype-builtins": ["error"],
            "no-redeclare": ["error"],
            "no-regex-spaces": ["error"],
            "no-self-assign": ["error"],
            "no-setter-return": ["error"],
            "no-shadow-restricted-names": ["error"],
            "no-sparse-arrays": ["error"],
            "no-this-before-super": ["error"],
            "no-undef": ["error"],
            "no-unexpected-multiline": ["error"],
            "no-unreachable": ["error"],
            "no-unsafe-finally": ["error"],
            "no-unsafe-negation": ["error"],
            "no-unsafe-optional-chaining": ["error"],
            "no-unused-labels": ["error"],
            "no-unused-private-class-members": ["error"],
            "no-unused-vars": [
                "error",
                {
                    "vars": "all",
                    "args": "after-used",
                    "ignoreRestSiblings": false,
                    "varsIgnorePattern": "^_",
                    "argsIgnorePattern": "^_",
                    // Allow imports used only in JSDoc
                    "caughtErrors": "none",
                    "ignoreTSDoc": false // Ensure JSDoc type references count as usage
                }
            ],
            "no-useless-backreference": ["error"],
            "no-useless-catch": ["error"],
            "no-useless-escape": ["error"],
            "no-with": ["error"],
            "require-yield": ["error"],
            "use-isnan": ["error"],
            "valid-typeof": ["error"],
            "no-unused-expressions": ["error"],
            // JSDoc-specific rules
            "jsdoc/require-jsdoc": ["warn", {
                "publicOnly": true,
                "require": {
                    "ClassDeclaration": true,
                    "FunctionDeclaration": true
                }
            }],
            "jsdoc/valid-types": "warn" // Warn on unresolved JSDoc types
        }
    }
];