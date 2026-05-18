with open('index.html', 'r', encoding='utf-8') as f:
    home_lines = f.readlines()

with open('index.html', 'r', encoding='utf-8') as f:
    index_lines = f.readlines()

start_home = -1
end_home = -1
for i, line in enumerate(home_lines):
    if 'id="modalAuth" class="modal-auth"' in line:
        start_home = i - 3  # Include the comment above it
    if start_home != -1 and i > start_home and '<div id="modal2FA' in line:
        end_home = i - 2
        break

modal_auth_lines = home_lines[start_home:end_home]

start_index = -1
end_index = -1
for i, line in enumerate(index_lines):
    if 'MODAL DE LOGIN' in line and '<div id="modalLogin"' in index_lines[i+1]:
        start_index = i
    if start_index != -1 and i > start_index and 'MODAL 2FA' in line:
        end_index = i - 1
        break

if start_index != -1 and end_index != -1 and start_home != -1 and end_home != -1:
    new_index_lines = index_lines[:start_index] + modal_auth_lines + ['\n'] + index_lines[end_index:]
    with open('index.html', 'w', encoding='utf-8') as f:
        f.writelines(new_index_lines)
    print("SUCCESS")
else:
    print("FAILED", start_home, end_home, start_index, end_index)
