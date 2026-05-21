%{
#include <stdio.h>
#include <string.h>

int line_num = 1;

void print_token(const char *type, const char *lexeme, int line) {
    /* Escape special characters in lexeme for clean parsing */
    printf("%s|", type);

    const char *p = lexeme;
    while (*p) {
        if (*p == '\\') {
            printf("\\\\");
        } else if (*p == '|') {
            printf("\\|");
        } else if (*p == '\n') {
            printf("\\n");
        } else if (*p == '\r') {
            printf("\\r");
        } else if (*p == '\t') {
            printf("\\t");
        } else {
            putchar(*p);
        }
        p++;
    }

    printf("|%d\n", line);
}
%}

%option noyywrap

DIGIT       [0-9]
LETTER      [a-zA-Z_]
HEX         [0-9a-fA-F]
OCT         [0-7]
EXP         [eE][+-]?{DIGIT}+
FLOAT_SUF   [fFlL]
INT_SUF     [uUlL]{1,3}

%%

 /* ======================== */
 /* Track line numbers       */
 /* ======================== */

\n                          { line_num++; }

 /* ======================== */
 /* Skip whitespace          */
 /* ======================== */

[ \t\r]+                    { /* skip whitespace */ }

 /* ======================== */
 /* Comments                 */
 /* ======================== */

"//"[^\n]*                  { print_token("COMMENT", yytext, line_num); }

"/*"([^*]|\*+[^*/])*\*+"/" {
    /* Count newlines inside block comments */
    int start_line = line_num;
    char *p = yytext;
    while (*p) {
        if (*p == '\n') line_num++;
        p++;
    }
    print_token("COMMENT", yytext, start_line);
}

 /* ======================== */
 /* Preprocessor directives  */
 /* ======================== */

^[ \t]*#[^\n]*              { print_token("PREPROCESSOR", yytext, line_num); }

 /* ======================== */
 /* String literals          */
 /* ======================== */

\"([^"\\]|\\.)*\"           {
    int start_line = line_num;
    char *p = yytext;
    while (*p) {
        if (*p == '\n') line_num++;
        p++;
    }
    print_token("STRING", yytext, start_line);
}

 /* ======================== */
 /* Character literals       */
 /* ======================== */

\'([^'\\]|\\.)*\'           { print_token("CHARACTER", yytext, line_num); }

 /* ======================== */
 /* C Keywords               */
 /* ======================== */

"auto"                      { print_token("KEYWORD", yytext, line_num); }
"break"                     { print_token("KEYWORD", yytext, line_num); }
"case"                      { print_token("KEYWORD", yytext, line_num); }
"char"                      { print_token("KEYWORD", yytext, line_num); }
"const"                     { print_token("KEYWORD", yytext, line_num); }
"continue"                  { print_token("KEYWORD", yytext, line_num); }
"default"                   { print_token("KEYWORD", yytext, line_num); }
"do"                        { print_token("KEYWORD", yytext, line_num); }
"double"                    { print_token("KEYWORD", yytext, line_num); }
"else"                      { print_token("KEYWORD", yytext, line_num); }
"enum"                      { print_token("KEYWORD", yytext, line_num); }
"extern"                    { print_token("KEYWORD", yytext, line_num); }
"float"                     { print_token("KEYWORD", yytext, line_num); }
"for"                       { print_token("KEYWORD", yytext, line_num); }
"goto"                      { print_token("KEYWORD", yytext, line_num); }
"if"                        { print_token("KEYWORD", yytext, line_num); }
"inline"                    { print_token("KEYWORD", yytext, line_num); }
"int"                       { print_token("KEYWORD", yytext, line_num); }
"long"                      { print_token("KEYWORD", yytext, line_num); }
"register"                  { print_token("KEYWORD", yytext, line_num); }
"restrict"                  { print_token("KEYWORD", yytext, line_num); }
"return"                    { print_token("KEYWORD", yytext, line_num); }
"short"                     { print_token("KEYWORD", yytext, line_num); }
"signed"                    { print_token("KEYWORD", yytext, line_num); }
"sizeof"                    { print_token("KEYWORD", yytext, line_num); }
"static"                    { print_token("KEYWORD", yytext, line_num); }
"struct"                    { print_token("KEYWORD", yytext, line_num); }
"switch"                    { print_token("KEYWORD", yytext, line_num); }
"typedef"                   { print_token("KEYWORD", yytext, line_num); }
"union"                     { print_token("KEYWORD", yytext, line_num); }
"unsigned"                  { print_token("KEYWORD", yytext, line_num); }
"void"                      { print_token("KEYWORD", yytext, line_num); }
"volatile"                  { print_token("KEYWORD", yytext, line_num); }
"while"                     { print_token("KEYWORD", yytext, line_num); }
"_Bool"                     { print_token("KEYWORD", yytext, line_num); }
"_Complex"                  { print_token("KEYWORD", yytext, line_num); }
"_Imaginary"                { print_token("KEYWORD", yytext, line_num); }

 /* ======================== */
 /* Identifiers              */
 /* ======================== */

{LETTER}({LETTER}|{DIGIT})* { print_token("IDENTIFIER", yytext, line_num); }

 /* ======================== */
 /* Numbers                  */
 /* ======================== */

0[xX]{HEX}+{INT_SUF}?                          { print_token("NUMBER", yytext, line_num); }
0{OCT}+{INT_SUF}?                               { print_token("NUMBER", yytext, line_num); }
{DIGIT}+{INT_SUF}?                               { print_token("NUMBER", yytext, line_num); }
{DIGIT}+"."{DIGIT}*{EXP}?{FLOAT_SUF}?           { print_token("NUMBER", yytext, line_num); }
"."{DIGIT}+{EXP}?{FLOAT_SUF}?                   { print_token("NUMBER", yytext, line_num); }
{DIGIT}+{EXP}{FLOAT_SUF}?                       { print_token("NUMBER", yytext, line_num); }

 /* ======================== */
 /* Multi-char operators     */
 /* ======================== */

">>="                       { print_token("OPERATOR", yytext, line_num); }
"<<="                       { print_token("OPERATOR", yytext, line_num); }
"+="                        { print_token("OPERATOR", yytext, line_num); }
"-="                        { print_token("OPERATOR", yytext, line_num); }
"*="                        { print_token("OPERATOR", yytext, line_num); }
"/="                        { print_token("OPERATOR", yytext, line_num); }
"%="                        { print_token("OPERATOR", yytext, line_num); }
"&="                        { print_token("OPERATOR", yytext, line_num); }
"^="                        { print_token("OPERATOR", yytext, line_num); }
"|="                        { print_token("OPERATOR", yytext, line_num); }
">>"                        { print_token("OPERATOR", yytext, line_num); }
"<<"                        { print_token("OPERATOR", yytext, line_num); }
"++"                        { print_token("OPERATOR", yytext, line_num); }
"--"                        { print_token("OPERATOR", yytext, line_num); }
"->"                        { print_token("OPERATOR", yytext, line_num); }
"&&"                        { print_token("OPERATOR", yytext, line_num); }
"||"                        { print_token("OPERATOR", yytext, line_num); }
"<="                        { print_token("OPERATOR", yytext, line_num); }
">="                        { print_token("OPERATOR", yytext, line_num); }
"=="                        { print_token("OPERATOR", yytext, line_num); }
"!="                        { print_token("OPERATOR", yytext, line_num); }
"..."                       { print_token("OPERATOR", yytext, line_num); }

 /* ======================== */
 /* Single-char operators    */
 /* ======================== */

"+"                         { print_token("OPERATOR", yytext, line_num); }
"-"                         { print_token("OPERATOR", yytext, line_num); }
"*"                         { print_token("OPERATOR", yytext, line_num); }
"/"                         { print_token("OPERATOR", yytext, line_num); }
"%"                         { print_token("OPERATOR", yytext, line_num); }
"&"                         { print_token("OPERATOR", yytext, line_num); }
"|"                         { print_token("OPERATOR", yytext, line_num); }
"^"                         { print_token("OPERATOR", yytext, line_num); }
"~"                         { print_token("OPERATOR", yytext, line_num); }
"!"                         { print_token("OPERATOR", yytext, line_num); }
"="                         { print_token("OPERATOR", yytext, line_num); }
"<"                         { print_token("OPERATOR", yytext, line_num); }
">"                         { print_token("OPERATOR", yytext, line_num); }
"?"                         { print_token("OPERATOR", yytext, line_num); }
":"                         { print_token("OPERATOR", yytext, line_num); }
"."                         { print_token("OPERATOR", yytext, line_num); }

 /* ======================== */
 /* Delimiters               */
 /* ======================== */

";"                         { print_token("DELIMITER", yytext, line_num); }
","                         { print_token("DELIMITER", yytext, line_num); }

 /* ======================== */
 /* Parentheses / Brackets   */
 /* ======================== */

"("                         { print_token("PARENTHESIS", yytext, line_num); }
")"                         { print_token("PARENTHESIS", yytext, line_num); }
"["                         { print_token("BRACKET", yytext, line_num); }
"]"                         { print_token("BRACKET", yytext, line_num); }
"{"                         { print_token("BRACE", yytext, line_num); }
"}"                         { print_token("BRACE", yytext, line_num); }

 /* ======================== */
 /* Invalid tokens           */
 /* ======================== */

.                           { print_token("INVALID", yytext, line_num); }

%%

int main(int argc, char **argv) {
    yylex();
    return 0;
}
