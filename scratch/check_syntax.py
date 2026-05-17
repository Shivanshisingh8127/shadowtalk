import os

files = [
    'src/pages/SettingsPrivacy.jsx',
    'src/pages/SettingsConversations.jsx',
    'src/pages/ContactProfile.jsx',
    'src/pages/SearchContacts.jsx',
    'src/pages/Appearance.jsx',
    'src/index.css'
]

workspace = 'd:/PROJECTSSS/new-app-session'

for f in files:
    path = os.path.join(workspace, f)
    if not os.path.exists(path):
        print(f"{f} does not exist")
        continue
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
        
        braces = 0
        parens = 0
        brackets = 0
        
        for char in content:
            if char == '{': braces += 1
            elif char == '}': braces -= 1
            elif char == '(': parens += 1
            elif char == ')': parens -= 1
            elif char == '[': brackets += 1
            elif char == ']': brackets -= 1
            
        print(f"{f}: braces={braces}, parens={parens}, brackets={brackets}")
