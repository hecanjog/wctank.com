%lex

%%

\s+                         /* skip whitespace */
"//".*                      /* ignore comments */    
[0-9]+("."[0-9]+)?\b        return 'NUMBER';
[a-zA-Z_][a-zA-Z0-9_]*9_    return 'IDENTIFIER';
"!"                         return 'BANG';
"#"                         return 'HASH';
"to"                        return 'TO';
"in"                        return 'IN';
"~"                         return 'REPEAT';
":"                         return 'COLON';
","                         return 'COMMA';
"{"                         return 'LBRACE';
"}"                         return 'RBRACE';
"("                         return 'LPAREN';
")"                         return 'RPAREN';
 
