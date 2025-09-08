// 全局变量
console.log('=== 记事本脚本已加载 v10 ===');

// 检查登录状态
async function checkLoginStatus() {
    const currentUser = localStorage.getItem('notebook_current_user');
    if (!currentUser) {
        window.location.href = 'login.html';
        return false;
    }
    
    // 验证用户是否仍然有效（可选）
    try {
        // 等待 Supabase 初始化完成
        if (typeof supabase !== 'undefined' && supabase) {
            const { data, error } = await supabase
                .from('users')
                .select('id, is_active')
                .eq('username', currentUser)
                .eq('is_active', true)
                .single();
            
            if (error || !data) {
                // 用户不存在或已被禁用
                localStorage.removeItem('notebook_current_user');
                window.location.href = 'login.html';
                return false;
            }
        }
    } catch (error) {
        console.error('验证用户状态失败:', error);
        // 网络错误时允许继续使用
    }
    
    return true;
}

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否已登录
    const currentUser = localStorage.getItem('notebook_current_user');
    console.log('当前用户:', currentUser);
    
    if (!currentUser) {
        // 未登录，跳转到登录页面
        console.log('未登录，跳转到登录页面');
        window.location.href = 'login.html';
        return;
    }
    
    // 已登录，初始化应用
    console.log('已登录，初始化应用');
    initializeAppAfterLogin();
});

// 显示当前用户
function displayCurrentUser() {
    const currentUser = localStorage.getItem('notebook_current_user');
    const userElement = document.getElementById('current-user');
    if (userElement && currentUser) {
        userElement.textContent = currentUser;
    }
}

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('notebook_current_user');
        window.location.href = 'login.html';
    }
}

let currentNote = null;
let notes = {};
let categories = ['默认'];
let currentCategory = '默认';
let currentTheme = localStorage.getItem('theme') || 'light';
let autoSaveTimer = null;
let isAutoSaving = false;
let lastEditedNote = localStorage.getItem('lastEditedNote');

// Supabase 配置
const supabaseUrl = 'https://zjqtwpoactfbvwtleoeu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqcXR3cG9hY3RmYnZ3dGxlb2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNTU4NjMsImV4cCI6MjA3MjczMTg2M30.glOPKH0uPBsxynVTpeaz-SIsWfo4raXcP7BSAZUfZ6U';

// 初始化 Supabase 客户端
let supabase = null;

// 延迟初始化 Supabase
function initializeSupabase() {
    try {
        if (window.supabase) {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            console.log('Supabase 客户端初始化成功');
            return true;
        } else {
            console.error('Supabase 库未加载');
            return false;
        }
    } catch (error) {
        console.error('Supabase 初始化失败:', error);
        return false;
    }
}

// Gitee 自动保存配置（保留作为备份）
let giteeConfig = {
    enabled: false, // 禁用 Gitee，使用 Supabase
    token: 'da87083614cbefd4a01618fcec759e4d',
    owner: 'nmghzz',
    repo: 'notebook-data',
    path: 'notebook-data.json'
};
let isSavingToGitee = false;
let isSavingToSupabase = false;

// 登录后初始化应用
function initializeAppAfterLogin() {
    // 显示当前用户
    displayCurrentUser();
    
    // 加载用户数据
    loadUserData();
    
    // 初始化应用
    initializeApp();
}

// 加载用户数据
function loadUserData() {
    const currentUser = localStorage.getItem('notebook_current_user');
    if (!currentUser) return;
    
    // 从 localStorage 加载用户特定的数据
    const userNotes = localStorage.getItem(`notes_${currentUser}`);
    const userCategories = localStorage.getItem(`categories_${currentUser}`);
    const userLastEditedNote = localStorage.getItem(`lastEditedNote_${currentUser}`);
    
    if (userNotes) {
        notes = JSON.parse(userNotes);
    }
    
    if (userCategories) {
        categories = JSON.parse(userCategories);
    } else {
        categories = ['默认'];
    }
    
    if (userLastEditedNote) {
        lastEditedNote = userLastEditedNote;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 登录检查已经在上面处理了
    
    // 初始化 Supabase
    setTimeout(async () => {
        if (initializeSupabase()) {
            // 初始化 Supabase 数据库表
            initializeSupabaseTables();
            
            // 优先从 Supabase 加载数据，覆盖本地数据
            console.log('正在从 Supabase 加载最新数据...');
            
            // 清除本地存储，确保完全从数据库加载
            const currentUser = localStorage.getItem('notebook_current_user');
            if (currentUser) {
                localStorage.removeItem(`notes_${currentUser}`);
                localStorage.removeItem(`categories_${currentUser}`);
                localStorage.removeItem(`lastEditedNote_${currentUser}`);
            }
            
            // 重置全局变量
            notes = {};
            categories = ['默认'];
            lastEditedNote = null;
            
            await loadFromSupabase(false);
            
            // 启动使用量显示
            startUsageAutoRefresh();
        } else {
            console.log('Supabase 初始化失败，使用本地存储');
            // 修复分类数据（如果需要）
            fixCategoryData();
            loadNotes();
            updateCategorySelect();
            applyTheme(currentTheme);
            // 即使 Supabase 失败，也显示本地使用量
            startUsageAutoRefresh();
        }
    }, 1000); // 延迟1秒等待 Supabase 库加载
});

// 初始化应用
function initializeApp() {
    // 设置编辑器事件监听
    const editor = document.getElementById('editor');
    const titleInput = document.getElementById('note-title');
    
    editor.addEventListener('input', debouncedAutoSave);
    titleInput.addEventListener('input', debouncedAutoSave);
    
    // 设置键盘快捷键
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // 设置窗口大小变化监听
    window.addEventListener('resize', handleResize);
    
    // 设置页面离开前的保存
    window.addEventListener('beforeunload', function() {
        if (currentNote && !isAutoSaving) {
            autoSave();
        }
    });
    
    // 设置字体选择器点击外部关闭
    document.getElementById('font-selector').addEventListener('click', function(e) {
        if (e.target === this) {
            closeFontSelector();
        }
    });
}

// 键盘快捷键处理
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'b':
                e.preventDefault();
                toggleBold();
                break;
            case 'i':
                e.preventDefault();
                toggleItalic();
                break;
            case 'u':
                e.preventDefault();
                toggleUnderline();
                break;
            case 's':
                e.preventDefault();
                saveNote();
                break;
        }
    }
}

// 窗口大小变化处理
function handleResize() {
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('open');
    }
}

// 加载笔记数据
function loadNotes() {
    const categoriesContainer = document.querySelector('.categories-container');
    categoriesContainer.innerHTML = '';
    
    categories.forEach(category => {
        createCategoryElement(category);
    });
    
    // 更新分类选择器
    updateCategorySelect();
    
    // 标记当前分类为活动状态
    if (currentCategory) {
        const categoryElement = document.querySelector(`[data-category="${currentCategory}"]`);
        if (categoryElement) {
            categoryElement.classList.add('active');
        }
    }
    
    // 如果有当前笔记，确保它被标记为活动状态
    if (currentNote && notes[currentNote]) {
        const noteItem = document.querySelector(`[data-note-id="${currentNote}"]`);
        if (noteItem) {
            noteItem.classList.add('active');
        }
        
        // 确保当前笔记所在的分类是展开的
        const note = notes[currentNote];
        if (note && note.category) {
            const categoryNotes = document.getElementById(`notes-${note.category}`);
            if (categoryNotes && !categoryNotes.classList.contains('expanded')) {
                toggleCategory(note.category);
            }
        }
    } else if (Object.keys(notes).length > 0) {
        // 优先加载最后编辑的笔记
        if (lastEditedNote && notes[lastEditedNote]) {
            loadNote(lastEditedNote);
        } else {
            // 如果没有最后编辑的笔记，加载第一个笔记
            const firstNoteId = Object.keys(notes)[0];
            loadNote(firstNoteId);
        }
    }
}

// 创建分类元素
function createCategoryElement(categoryName) {
    const categoriesContainer = document.querySelector('.categories-container');
    
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category';
    categoryDiv.setAttribute('data-category', categoryName);
    
    const categoryNotes = getNotesByCategory(categoryName);
    
    categoryDiv.innerHTML = `
        <div class="category-header">
            <div class="category-name" onclick="selectCategory('${categoryName}')">
                <i class="fas fa-folder"></i>
                <span>${categoryName}</span>
            </div>
            <div class="category-actions">
                <button class="category-edit-btn" onclick="event.stopPropagation(); editCategoryName('${categoryName}')" title="重命名分类">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="category-delete-btn" onclick="event.stopPropagation(); deleteCategory('${categoryName}')" title="删除分类">
                    <i class="fas fa-trash"></i>
                </button>
                <div class="category-toggle" onclick="toggleCategory('${categoryName}')">
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>
        </div>
        <div class="category-notes" id="notes-${categoryName}">
            ${categoryNotes.map(note => `
                <div class="note-item" onclick="loadNote('${note.id}')" data-note-id="${note.id}">
                    <h4>${note.title || '无标题'}</h4>
                    <p>${getNotePreview(note.content)}</p>
                    <div class="note-actions">
                        <button onclick="event.stopPropagation(); deleteNote('${note.id}')" title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    categoriesContainer.appendChild(categoryDiv);
}

// 获取指定分类的笔记
function getNotesByCategory(category) {
    return Object.values(notes).filter(note => note.category === category);
}

// ==================== 分类管理功能 ====================

// 编辑分类名称
function editCategoryName(oldCategoryName) {
    if (oldCategoryName === '默认') {
        showNotification('默认分类不能重命名！', 'warning');
        return;
    }
    
    const newCategoryName = prompt('请输入新的分类名称:', oldCategoryName);
    
    if (!newCategoryName || newCategoryName.trim() === '') {
        return;
    }
    
    const trimmedName = newCategoryName.trim();
    
    // 检查新名称是否已存在
    if (categories.includes(trimmedName)) {
        showNotification('分类名称已存在！', 'error');
        return;
    }
    
    // 检查名称长度
    if (trimmedName.length > 20) {
        showNotification('分类名称不能超过20个字符！', 'error');
        return;
    }
    
    try {
        // 更新分类数组
        const categoryIndex = categories.indexOf(oldCategoryName);
        if (categoryIndex !== -1) {
            categories[categoryIndex] = trimmedName;
        }
        
        // 更新所有相关笔记的分类
        Object.values(notes).forEach(note => {
            if (note.category === oldCategoryName) {
                note.category = trimmedName;
                note.updatedAt = new Date().toISOString();
            }
        });
        
        // 更新当前分类
        if (currentCategory === oldCategoryName) {
            currentCategory = trimmedName;
        }
        
        // 保存数据
        saveNotes();
        saveCategories();
        
        // 同步到数据库
        if (typeof saveToSupabase === 'function') {
            saveToSupabase().then(() => {
                console.log('分类重命名已同步到数据库');
            }).catch(error => {
                console.error('同步到数据库失败:', error);
            });
        }
        
        // 更新界面
        loadNotes();
        updateCategorySelect();
        
        showNotification(`分类"${oldCategoryName}"已重命名为"${trimmedName}"`, 'success');
        
        console.log(`分类重命名: ${oldCategoryName} -> ${trimmedName}`);
        
    } catch (error) {
        console.error('重命名分类失败:', error);
        showNotification('重命名失败: ' + error.message, 'error');
    }
}

// 删除分类
function deleteCategory(categoryName) {
    if (categoryName === '默认') {
        showNotification('默认分类不能删除！', 'warning');
        return;
    }
    
    // 检查分类下是否有笔记
    const categoryNotes = getNotesByCategory(categoryName);
    
    if (categoryNotes.length > 0) {
        const confirmMessage = `分类"${categoryName}"下还有 ${categoryNotes.length} 条笔记，删除分类将把这些笔记移动到"默认"分类。\n\n确定要删除这个分类吗？`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // 将笔记移动到默认分类
        categoryNotes.forEach(note => {
            note.category = '默认';
            note.updatedAt = new Date().toISOString();
        });
        
        showNotification(`已将 ${categoryNotes.length} 条笔记移动到"默认"分类`, 'info');
    } else {
        if (!confirm(`确定要删除分类"${categoryName}"吗？`)) {
            return;
        }
    }
    
    try {
        // 从分类数组中移除
        const categoryIndex = categories.indexOf(categoryName);
        if (categoryIndex !== -1) {
            categories.splice(categoryIndex, 1);
        }
        
        // 更新当前分类
        if (currentCategory === categoryName) {
            currentCategory = '默认';
        }
        
        // 保存数据
        saveNotes();
        saveCategories();
        
        // 同步到数据库
        if (typeof saveToSupabase === 'function') {
            saveToSupabase().then(() => {
                console.log('分类删除已同步到数据库');
            }).catch(error => {
                console.error('同步到数据库失败:', error);
            });
        }
        
        // 更新界面
        loadNotes();
        updateCategorySelect();
        
        showNotification(`分类"${categoryName}"已删除`, 'success');
        
        console.log(`分类已删除: ${categoryName}`);
        
    } catch (error) {
        console.error('删除分类失败:', error);
        showNotification('删除失败: ' + error.message, 'error');
    }
}

// 获取笔记预览文本
function getNotePreview(content) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
}

// 选择分类（仅用于新建笔记，不影响当前笔记的分类）
function selectCategory(categoryName) {
    currentCategory = categoryName;
    
    // 不更新右侧的分类选择器，保持当前笔记的分类不变
    
    // 更新分类活动状态
    document.querySelectorAll('.category').forEach(cat => {
        cat.classList.remove('active');
    });
    document.querySelector(`[data-category="${categoryName}"]`).classList.add('active');
    
    // 显示通知
    showNotification(`已选择分类：${categoryName}（新建笔记将在此分类下）`, 'info');
}

// 清除分类选择器状态
function clearCategorySelection() {
    const categoryTrigger = document.getElementById('category-trigger');
    if (categoryTrigger) {
        categoryTrigger.classList.remove('selected');
    }
    
    document.querySelectorAll('.category').forEach(cat => {
        cat.classList.remove('active');
    });
}

// 处理分类变更
function handleCategoryChange() {
    const categoryDisplay = document.getElementById('category-display');
    const newCategory = categoryDisplay ? categoryDisplay.textContent : '默认';
    const categoryTrigger = document.getElementById('category-trigger');
    
    // 立即更新当前分类，确保后续操作使用正确的分类
    currentCategory = newCategory;
    
    if (currentNote && notes[currentNote]) {
        const note = notes[currentNote];
        const oldCategory = note.category;
        
        // 更新笔记的分类
        note.category = newCategory;
        note.updatedAt = new Date().toISOString();
        
        // 保存笔记
        saveNotes();
        
        // 更新分类选择器状态
        if (categoryTrigger) {
            categoryTrigger.classList.add('selected');
        }
        
        // 重新加载笔记列表
        loadNotes();
        
        // 不更新左侧分类活动状态，保持用户之前选择的分类
        
        // 确保新分类展开
        const categoryNotes = document.getElementById(`notes-${newCategory}`);
        if (categoryNotes && !categoryNotes.classList.contains('expanded')) {
            toggleCategory(newCategory);
        }
        
        // 显示通知
        showNotification(`笔记已移动到"${newCategory}"分类`, 'success');
        
        // 更新保存状态
        updateSaveStatus('saved');
    } else {
        // 即使没有当前笔记，也要更新分类选择器状态
        if (categoryTrigger) {
            categoryTrigger.classList.add('selected');
        }
        
        // 不更新左侧分类活动状态，保持用户之前选择的分类
    }
}

// 切换分类展开/收起
function toggleCategory(categoryName) {
    const categoryNotes = document.getElementById(`notes-${categoryName}`);
    const chevron = document.querySelector(`[data-category="${categoryName}"] .fa-chevron-down`);
    
    if (categoryNotes.classList.contains('expanded')) {
        categoryNotes.classList.remove('expanded');
        chevron.style.transform = 'rotate(0deg)';
    } else {
        categoryNotes.classList.add('expanded');
        chevron.style.transform = 'rotate(180deg)';
    }
}

// 添加新分类
function addCategory() {
    const categoryName = prompt('请输入分类名称：');
    if (categoryName && categoryName.trim() && !categories.includes(categoryName.trim())) {
        const newCategoryName = categoryName.trim();
        categories.push(newCategoryName);
        saveCategories();
        
        // 同步到 Supabase 数据库
        if (typeof saveToSupabase === 'function') {
            saveToSupabase().then(() => {
                console.log('新分类已同步到数据库');
            }).catch(error => {
                console.error('同步到数据库失败:', error);
                showNotification('分类已创建，但同步到数据库失败', 'warning');
            });
        }
        
        createCategoryElement(newCategoryName);
        updateCategorySelect();
        
        // 自动选择新创建的分类
        selectCategory(newCategoryName);
        
        showNotification(`分类"${newCategoryName}"已创建并选中！`, 'success');
    } else if (categoryName && categoryName.trim() && categories.includes(categoryName.trim())) {
        showNotification('分类已存在！', 'warning');
    }
}

// 更新分类选择器
function updateCategorySelect() {
    const categoryDisplay = document.getElementById('category-display');
    const categoryMenu = document.getElementById('category-menu');
    const categoryTrigger = document.getElementById('category-trigger');
    
    if (!categoryDisplay || !categoryMenu || !categoryTrigger) {
        console.error('找不到分类选择器元素');
        return;
    }
    
    console.log('=== 更新分类选择器 ===');
    console.log('当前分类数组:', categories);
    console.log('分类数组长度:', categories.length);
    
    // 保存当前选中的值
    const currentValue = categoryDisplay.textContent;
    console.log('当前选中的值:', currentValue);
    
    // 重新生成选项
    const menuHTML = categories.map(cat => 
        `<div class="category-dropdown-item" data-value="${cat}" onclick="selectCategoryFromDropdown('${cat}')">${cat}</div>`
    ).join('');
    
    console.log('生成的菜单HTML:', menuHTML);
    categoryMenu.innerHTML = menuHTML;
    
    // 恢复之前选中的值，如果不存在则选择第一个
    if (categories.includes(currentValue)) {
        updateCategoryDisplay(currentValue);
        console.log('恢复之前选中的值:', currentValue);
    } else if (categories.length > 0) {
        updateCategoryDisplay(categories[0]);
        console.log('选择第一个分类:', categories[0]);
    }
    
    console.log('最终选中的值:', categoryDisplay.textContent);
    console.log('菜单选项数量:', categoryMenu.children.length);
    console.log('=== 分类选择器更新完成 ===');
}

// 更新分类显示
function updateCategoryDisplay(categoryName) {
    const categoryDisplay = document.getElementById('category-display');
    const categoryTrigger = document.getElementById('category-trigger');
    
    if (categoryDisplay) {
        categoryDisplay.textContent = categoryName;
    }
    
    // 更新选中状态
    if (categoryTrigger) {
        categoryTrigger.classList.add('selected');
    }
    
    // 更新菜单项的选中状态
    document.querySelectorAll('.category-dropdown-item').forEach(item => {
        item.classList.remove('selected');
        if (item.getAttribute('data-value') === categoryName) {
            item.classList.add('selected');
        }
    });
}

// 更新左侧分类选择状态
function updateLeftSidebarCategorySelection(categoryName) {
    // 清除所有分类的活动状态
    document.querySelectorAll('.category').forEach(cat => {
        cat.classList.remove('active');
    });
    
    // 设置指定分类为活动状态
    const categoryElement = document.querySelector(`[data-category="${categoryName}"]`);
    if (categoryElement) {
        categoryElement.classList.add('active');
    }
    
    // 更新当前分类变量
    currentCategory = categoryName;
}

// 从下拉菜单选择分类
function selectCategoryFromDropdown(categoryName) {
    updateCategoryDisplay(categoryName);
    
    // 更新左侧分类选择状态
    updateLeftSidebarCategorySelection(categoryName);
    
    // 触发分类变更事件
    handleCategoryChange();
}

// 保存分类数据
function saveCategories() {
    const currentUser = localStorage.getItem('notebook_current_user');
    if (currentUser) {
        localStorage.setItem(`categories_${currentUser}`, JSON.stringify(categories));
    }
}

// ==================== Supabase 数据库功能 ====================

// 初始化 Supabase 数据库表
async function initializeSupabaseTables() {
    try {
        // 检查 notes 表是否存在，如果不存在则创建
        const { data: tables, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'notes');
        
        if (error) {
            console.log('检查表结构时出错，可能需要手动创建表:', error);
            return;
        }
        
        if (!tables || tables.length === 0) {
            console.log('notes 表不存在，请手动在 Supabase 中创建表');
            showNotification('请先在 Supabase 中创建数据库表', 'warning');
        } else {
            console.log('Supabase 数据库连接成功');
        }
    } catch (error) {
        console.error('初始化 Supabase 表时出错:', error);
    }
}

// 保存数据到 Supabase
async function saveToSupabase() {
    if (!supabase) {
        console.error('Supabase 客户端未初始化');
        showNotification('Supabase 未初始化，无法保存', 'error');
        return { success: false, error: 'Supabase 未初始化' };
    }
    
    if (isSavingToSupabase) {
        return;
    }
    
    isSavingToSupabase = true;
    
    try {
        // 保存所有笔记
        const currentUser = localStorage.getItem('notebook_current_user');
        for (const [noteId, note] of Object.entries(notes)) {
            console.log('保存笔记到 Supabase:', noteId, {
                title: note.title,
                content: note.content,
                category: note.category
            });
            
            const { error } = await supabase
                .from('notes')
                .upsert({
                    id: noteId,
                    user_id: currentUser,
                    title: note.title,
                    content: note.content,
                    category: note.category,
                    background_color: note.backgroundColor,
                    created_at: note.createdAt,
                    updated_at: note.updatedAt
                });
            
            if (error) {
                console.error('保存笔记失败:', noteId, error);
            } else {
                console.log('笔记保存成功:', noteId);
            }
        }
        
        // 保存分类
        console.log('保存分类到 Supabase:', {
            id: `categories_${currentUser}`,
            user_id: currentUser,
            categories: categories,
            theme: currentTheme,
            last_edited_note: lastEditedNote
        });
        
        const { error: categoryError } = await supabase
            .from('categories')
            .upsert({
                id: `categories_${currentUser}`,
                user_id: currentUser,
                categories: categories,
                theme: currentTheme,
                last_edited_note: lastEditedNote,
                updated_at: new Date().toISOString()
            });
        
        if (categoryError) {
            console.error('保存分类失败:', categoryError);
        } else {
            console.log('分类保存成功');
        }
        
        console.log('数据已保存到 Supabase');
        return { success: true };
    } catch (error) {
        console.error('保存到 Supabase 失败:', error);
        return { success: false, error: error.message };
    } finally {
        isSavingToSupabase = false;
    }
}

// 强制从数据库加载数据
async function forceLoadFromDatabase() {
    if (!supabase) {
        showNotification('Supabase 未初始化', 'error');
        return;
    }
    
    showNotification('正在强制从数据库加载数据...', 'info');
    
    // 清除本地存储
    const currentUser = localStorage.getItem('notebook_current_user');
    if (currentUser) {
        localStorage.removeItem(`notes_${currentUser}`);
        localStorage.removeItem(`categories_${currentUser}`);
        localStorage.removeItem(`lastEditedNote_${currentUser}`);
    }
    
    // 重置全局变量
    notes = {};
    categories = ['默认'];
    lastEditedNote = null;
    
    // 从数据库加载
    await loadFromSupabase(true);
}

// 从 Supabase 加载数据
async function loadFromSupabase(showNotification = true) {
    if (showNotification) {
        showNotification('正在从 Supabase 加载数据...', 'info');
    }
    
    try {
        // 加载笔记
        const currentUser = localStorage.getItem('notebook_current_user');
        const { data: notesData, error: notesError } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', currentUser);
        
        if (notesError) {
            console.error('加载笔记失败:', notesError);
            if (showNotification) {
                showNotification('加载笔记失败: ' + notesError.message, 'error');
            }
            return;
        }
        
        // 加载分类和设置
        const { data: settingsData, error: settingsError } = await supabase
            .from('categories')
            .select('*')
            .eq('id', `categories_${currentUser}`)
            .single();
        
        if (settingsError && settingsError.code !== 'PGRST116') { // PGRST116 表示没有找到记录
            console.error('加载设置失败:', settingsError);
        }
        
        // 完全替换本地数据
        if (notesData && notesData.length > 0) {
            const newNotes = {};
            notesData.forEach(note => {
                newNotes[note.id] = {
                    id: note.id,
                    title: note.title,
                    content: note.content,
                    category: note.category,
                    backgroundColor: note.background_color,
                    createdAt: note.created_at,
                    updatedAt: note.updated_at
                };
            });
            
            // 完全替换本地数据，不合并
            notes = newNotes;
            console.log(`从数据库加载了 ${Object.keys(notes).length} 条笔记`);
        } else {
            // 如果数据库没有数据，清空本地数据
            notes = {};
            console.log('数据库中没有笔记，清空本地数据');
        }
        
        if (settingsData) {
            if (settingsData.categories) {
                // 完全替换分类数据，不合并
                categories = settingsData.categories;
                console.log(`从数据库加载了分类: ${categories.join(', ')}`);
            }
            if (settingsData.theme) {
                currentTheme = settingsData.theme;
            }
            if (settingsData.last_edited_note) {
                lastEditedNote = settingsData.last_edited_note;
            }
        } else {
            // 如果数据库没有设置数据，使用默认分类
            categories = ['默认'];
            console.log('数据库中没有设置数据，使用默认分类');
        }
        
        // 保存到本地存储
        saveNotes();
        saveCategories();
        localStorage.setItem('theme', currentTheme);
        if (currentUser) {
            localStorage.setItem(`lastEditedNote_${currentUser}`, lastEditedNote);
        }
        
        // 更新界面
        loadNotes();
        updateCategorySelect();
        applyTheme(currentTheme);
        
        if (showNotification) {
            showNotification('数据加载成功！', 'success');
        }
    } catch (error) {
        console.error('从 Supabase 加载数据失败:', error);
        if (showNotification) {
            showNotification('加载失败: ' + error.message, 'error');
        }
    }
}

// 自动保存到 Supabase
async function autoSaveToSupabase() {
    if (!isSavingToSupabase) {
        // 延迟3秒后自动保存，避免频繁保存
        setTimeout(() => {
            if (!isSavingToSupabase) {
                saveToSupabase();
            }
        }, 3000);
    }
}

// ==================== 使用量显示功能 ====================

// 获取数据库使用量
async function getDatabaseUsage() {
    if (!supabase) {
        console.error('Supabase 客户端未初始化');
        return null;
    }
    
    try {
        // 获取笔记数量
        const { data: notesData, error: notesError } = await supabase
            .from('notes')
            .select('id', { count: 'exact' });
        
        if (notesError) {
            console.error('获取笔记数量失败:', notesError);
            return null;
        }
        
        // 计算用户数据大小（只计算笔记和分类数据）
        let dbSize = '未知';
        let dbSizeBytes = 0;
        try {
            // 计算所有笔记的总大小
            const allNotes = Object.values(notes);
            let totalSize = 0;
            
            allNotes.forEach(note => {
                // 计算每个笔记的JSON字符串大小
                const noteJson = JSON.stringify(note);
                totalSize += new Blob([noteJson]).size;
            });
            
            // 添加分类数据的开销
            const categoriesJson = JSON.stringify(categories);
            totalSize += new Blob([categoriesJson]).size;
            
            // 添加其他用户数据的估算开销（主题、设置等）
            const settingsJson = JSON.stringify({
                theme: currentTheme,
                lastEditedNote: lastEditedNote
            });
            totalSize += new Blob([settingsJson]).size;
            
            dbSizeBytes = totalSize;
            
            // 转换为可读格式
            if (totalSize < 1024) {
                dbSize = `${totalSize} B`;
            } else if (totalSize < 1024 * 1024) {
                dbSize = `${(totalSize / 1024).toFixed(1)} KB`;
            } else if (totalSize < 1024 * 1024 * 1024) {
                dbSize = `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
            } else {
                dbSize = `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            }
            
            console.log(`用户数据大小: ${dbSize} (${totalSize} 字节)`);
        } catch (error) {
            console.error('计算用户数据大小失败:', error);
            dbSize = '计算失败';
            dbSizeBytes = 0;
        }
        
        return {
            notesCount: notesData.length || 0,
            dbSize: dbSize,
            dbSizeBytes: dbSizeBytes,
            totalLimit: '500MB' // Supabase 免费计划限制
        };
    } catch (error) {
        console.error('获取使用量失败:', error);
        return null;
    }
}

// 更新使用量显示
async function updateUsageDisplay() {
    const usage = await getDatabaseUsage();
    
    if (!usage) {
        // 如果无法获取 Supabase 数据，显示本地数据
        const localNotesCount = Object.keys(notes).length;
        document.getElementById('notes-count').textContent = localNotesCount;
        document.getElementById('db-size').textContent = '本地存储';
        document.getElementById('usage-percentage').textContent = '-';
        document.getElementById('usage-bar').style.width = '0%';
        return;
    }
    
    // 更新显示
    document.getElementById('notes-count').textContent = usage.notesCount;
    document.getElementById('db-size').textContent = usage.dbSize;
    
    // 计算使用率（基于用户数据，假设 100MB 用户数据限制）
    const totalLimitBytes = 100 * 1024 * 1024; // 100MB 用户数据限制
    const currentSizeBytes = usage.dbSizeBytes || 0;
    const usagePercentage = Math.min((currentSizeBytes / totalLimitBytes) * 100, 100);
    
    console.log(`使用率计算: ${currentSizeBytes} 字节 / ${totalLimitBytes} 字节 = ${usagePercentage.toFixed(1)}%`);
    
    document.getElementById('usage-percentage').textContent = `${usagePercentage.toFixed(1)}%`;
    
    // 更新进度条
    const usageBar = document.getElementById('usage-bar');
    usageBar.style.width = `${usagePercentage}%`;
    
    // 根据使用率设置颜色
    usageBar.className = 'usage-bar';
    if (usagePercentage < 50) {
        usageBar.classList.add('low');
    } else if (usagePercentage < 80) {
        usageBar.classList.add('medium');
    } else {
        usageBar.classList.add('high');
    }
}

// 刷新使用量
async function refreshUsage() {
    const refreshBtn = document.querySelector('.refresh-usage-btn i');
    refreshBtn.style.animation = 'spin 1s linear infinite';
    
    try {
        await updateUsageDisplay();
        showNotification('使用量已刷新', 'success');
    } catch (error) {
        console.error('刷新使用量失败:', error);
        showNotification('刷新失败', 'error');
    } finally {
        refreshBtn.style.animation = '';
    }
}

// 自动刷新使用量
function startUsageAutoRefresh() {
    // 初始加载
    updateUsageDisplay();
    
    // 每5分钟自动刷新一次
    setInterval(updateUsageDisplay, 5 * 60 * 1000);
}

// ==================== 云端同步功能 ====================

// 显示同步设置对话框
function showSyncSettings() {
    const modal = document.getElementById('modal');
    const modalContent = `
        <div class="sync-settings">
            <h3><i class="fas fa-cloud"></i> 云端同步设置</h3>
            <div class="sync-options">
                <div class="sync-option">
                    <input type="radio" id="sync-github" name="sync-provider" value="github" ${syncConfig.provider === 'github' ? 'checked' : ''}>
                    <label for="sync-github">
                        <i class="fab fa-github"></i>
                        <div>
                            <strong>GitHub</strong>
                            <p>使用GitHub仓库存储数据</p>
                        </div>
                    </label>
                </div>
                <div class="sync-option">
                    <input type="radio" id="sync-gitee" name="sync-provider" value="gitee" ${syncConfig.provider === 'gitee' ? 'checked' : ''}>
                    <label for="sync-gitee">
                        <i class="fas fa-code-branch"></i>
                        <div>
                            <strong>Gitee</strong>
                            <p>使用Gitee仓库存储数据</p>
                        </div>
                    </label>
                </div>
                <div class="sync-option">
                    <input type="radio" id="sync-webdav" name="sync-provider" value="webdav" ${syncConfig.provider === 'webdav' ? 'checked' : ''}>
                    <label for="sync-webdav">
                        <i class="fas fa-server"></i>
                        <div>
                            <strong>WebDAV</strong>
                            <p>使用WebDAV服务器存储数据</p>
                        </div>
                    </label>
                </div>
            </div>
            <div class="sync-config">
                <div class="form-group">
                    <label for="sync-username">用户名/仓库名:</label>
                    <input type="text" id="sync-username" placeholder="例如: username/notebook-data" value="${syncConfig.username || ''}">
                </div>
                <div class="form-group">
                    <label for="sync-token">访问令牌:</label>
                    <input type="password" id="sync-token" placeholder="输入访问令牌" value="${syncConfig.token || ''}">
                    <small>GitHub/Gitee: Personal Access Token | WebDAV: 服务器地址</small>
                </div>
                <div class="form-group">
                    <label for="sync-repo">仓库名 (可选):</label>
                    <input type="text" id="sync-repo" placeholder="例如: notebook-data" value="${syncConfig.repo || ''}">
                </div>
            </div>
            <div class="sync-actions">
                <button class="btn btn-primary" onclick="saveSyncConfig()">
                    <i class="fas fa-save"></i> 保存设置
                </button>
                <button class="btn btn-success" onclick="testSyncConnection()">
                    <i class="fas fa-plug"></i> 测试连接
                </button>
                <button class="btn btn-info" onclick="syncToCloud()">
                    <i class="fas fa-cloud-upload-alt"></i> 立即同步
                </button>
                <button class="btn btn-secondary" onclick="closeModal()">
                    <i class="fas fa-times"></i> 关闭
                </button>
            </div>
            <div class="sync-status">
                <p><strong>同步状态:</strong> ${syncConfig.enabled ? '已启用' : '未启用'}</p>
                ${syncConfig.lastSync ? `<p><strong>最后同步:</strong> ${new Date(syncConfig.lastSync).toLocaleString()}</p>` : ''}
            </div>
        </div>
    `;
    
    modal.innerHTML = modalContent;
    modal.style.display = 'flex';
}

// 保存同步配置
function saveSyncConfig() {
    const provider = document.querySelector('input[name="sync-provider"]:checked').value;
    const username = document.getElementById('sync-username').value.trim();
    const token = document.getElementById('sync-token').value.trim();
    const repo = document.getElementById('sync-repo').value.trim();
    
    if (!username || !token) {
        showNotification('请填写完整的同步配置信息！', 'error');
        return;
    }
    
    syncConfig = {
        enabled: true,
        provider: provider,
        username: username,
        token: token,
        repo: repo || 'notebook-data',
        lastSync: null
    };
    
    localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
    showNotification('同步配置已保存！', 'success');
    closeModal();
}

// 测试同步连接
async function testSyncConnection() {
    if (!syncConfig.enabled) {
        showNotification('请先保存同步配置！', 'warning');
        return;
    }
    
    showNotification('正在测试连接...', 'info');
    
    try {
        const testData = {
            test: true,
            timestamp: new Date().toISOString()
        };
        
        const result = await uploadToCloud(testData, 'test.json');
        
        if (result.success) {
            showNotification('连接测试成功！', 'success');
        } else {
            showNotification('连接测试失败: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('连接测试失败: ' + error.message, 'error');
    }
}

// 上传数据到云端
async function uploadToCloud(data, filename) {
    const { provider, username, token, repo } = syncConfig;
    
    try {
        if (provider === 'github') {
            return await uploadToGitHub(data, filename, username, token, repo);
        } else if (provider === 'gitee') {
            return await uploadToGitee(data, filename, username, token, repo);
        } else if (provider === 'webdav') {
            return await uploadToWebDAV(data, filename, token);
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// GitHub上传
async function uploadToGitHub(data, filename, username, token, repo) {
    const [owner, repoName] = username.includes('/') ? username.split('/') : [username, repo];
    
    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filename}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `Update ${filename}`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
            sha: await getFileSHA(owner, repoName, filename, token)
        })
    });
    
    if (response.ok) {
        return { success: true };
    } else {
        const error = await response.json();
        return { success: false, error: error.message || '上传失败' };
    }
}

// Gitee上传
async function uploadToGitee(data, filename, username, token, repo) {
    const [owner, repoName] = username.includes('/') ? username.split('/') : [username, repo];
    
    // 获取文件 SHA（如果文件存在）
    const sha = await getGiteeFileSHA(owner, repoName, filename, token);
    
    // 根据文件是否存在选择 HTTP 方法
    const method = sha ? 'PUT' : 'POST';
    
    const response = await fetch(`https://gitee.com/api/v5/repos/${owner}/${repoName}/contents/${filename}`, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            access_token: token,
            message: `Update ${filename}`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
            sha: sha
        })
    });
    
    if (response.ok) {
        return { success: true };
    } else {
        const error = await response.json();
        return { success: false, error: error.message || '上传失败' };
    }
}

// WebDAV上传
async function uploadToWebDAV(data, filename, serverUrl) {
    const response = await fetch(`${serverUrl}/${filename}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data, null, 2)
    });
    
    if (response.ok) {
        return { success: true };
    } else {
        return { success: false, error: 'WebDAV上传失败' };
    }
}

// 获取文件SHA (GitHub)
async function getFileSHA(owner, repo, filename, token) {
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filename}`, {
            headers: {
                'Authorization': `token ${token}`,
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
    } catch (error) {
        // 文件不存在，返回null
    }
    return null;
}

// 获取文件SHA (Gitee)
async function getGiteeFileSHA(owner, repo, filename, token) {
    try {
        const response = await fetch(`https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${filename}?access_token=${token}`);
        
        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
    } catch (error) {
        // 文件不存在，返回null
    }
    return null;
}

// 同步到云端
async function syncToCloud() {
    if (!syncConfig.enabled) {
        showNotification('请先配置云端同步！', 'warning');
        return;
    }
    
    if (isSyncing) {
        showNotification('正在同步中，请稍候...', 'info');
        return;
    }
    
    isSyncing = true;
    showNotification('正在同步到云端...', 'info');
    
    try {
        const syncData = {
            notes: notes,
            categories: categories,
            theme: currentTheme,
            lastEditedNote: lastEditedNote,
            syncTime: new Date().toISOString(),
            version: '1.0'
        };
        
        const result = await uploadToCloud(syncData, 'notebook-data.json');
        
        if (result.success) {
            syncConfig.lastSync = new Date().toISOString();
            localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
            showNotification('同步成功！', 'success');
        } else {
            showNotification('同步失败: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('同步失败: ' + error.message, 'error');
    } finally {
        isSyncing = false;
    }
}

// 从云端同步
async function syncFromCloud() {
    if (!syncConfig.enabled) {
        showNotification('请先配置云端同步！', 'warning');
        return;
    }
    
    if (isSyncing) {
        showNotification('正在同步中，请稍候...', 'info');
        return;
    }
    
    isSyncing = true;
    showNotification('正在从云端同步...', 'info');
    
    try {
        const { provider, username, token, repo } = syncConfig;
        let data;
        
        if (provider === 'github') {
            data = await downloadFromGitHub(username, token, repo);
        } else if (provider === 'gitee') {
            data = await downloadFromGitee(username, token, repo);
        } else if (provider === 'webdav') {
            data = await downloadFromWebDAV(token);
        }
        
        if (data && data.notes) {
            // 合并数据
            notes = { ...notes, ...data.notes };
            categories = [...new Set([...categories, ...data.categories])];
            
            if (data.theme) currentTheme = data.theme;
            if (data.lastEditedNote) lastEditedNote = data.lastEditedNote;
            
            // 保存到本地
            saveNotes();
            saveCategories();
            localStorage.setItem('theme', currentTheme);
            const currentUser = localStorage.getItem('notebook_current_user');
        if (currentUser) {
            localStorage.setItem(`lastEditedNote_${currentUser}`, lastEditedNote);
        }
            
            // 更新界面
            loadNotes();
            updateCategorySelect();
            applyTheme(currentTheme);
            
            syncConfig.lastSync = new Date().toISOString();
            localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
            
            showNotification('同步成功！', 'success');
        } else {
            showNotification('云端没有找到数据', 'warning');
        }
    } catch (error) {
        showNotification('同步失败: ' + error.message, 'error');
    } finally {
        isSyncing = false;
    }
}

// 从GitHub下载
async function downloadFromGitHub(username, token, repo) {
    const [owner, repoName] = username.includes('/') ? username.split('/') : [username, repo];
    
    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/notebook-data.json`, {
        headers: {
            'Authorization': `token ${token}`,
        }
    });
    
    if (response.ok) {
        const data = await response.json();
        return JSON.parse(decodeURIComponent(escape(atob(data.content))));
    } else {
        throw new Error('下载失败');
    }
}

// 从Gitee下载
async function downloadFromGitee(username, token, repo) {
    const [owner, repoName] = username.includes('/') ? username.split('/') : [username, repo];
    
    const response = await fetch(`https://gitee.com/api/v5/repos/${owner}/${repoName}/contents/notebook-data.json?access_token=${token}`);
    
    if (response.ok) {
        const data = await response.json();
        return JSON.parse(decodeURIComponent(escape(atob(data.content))));
    } else {
        throw new Error('下载失败');
    }
}

// 从WebDAV下载
async function downloadFromWebDAV(serverUrl) {
    const response = await fetch(`${serverUrl}/notebook-data.json`);
    
    if (response.ok) {
        return await response.json();
    } else {
        throw new Error('下载失败');
    }
}

// 自动保存到 Gitee（在保存时触发）
async function autoSaveToGitee() {
    if (giteeConfig.enabled && !isSavingToGitee) {
        // 延迟3秒后自动保存，避免频繁保存
        setTimeout(() => {
            if (!isSavingToGitee) {
                saveToGitee();
            }
        }, 3000);
    }
}

// 保存数据到 Gitee
async function saveToGitee() {
    if (!giteeConfig.enabled || isSavingToGitee) {
        return;
    }
    
    isSavingToGitee = true;
    
    try {
        const data = {
            notes: notes,
            categories: categories,
            theme: currentTheme,
            lastEditedNote: lastEditedNote,
            saveTime: new Date().toISOString(),
            version: '1.0'
        };
        
        const result = await uploadToGitee(data);
        
        if (result.success) {
            console.log('数据已自动保存到 Gitee');
        } else {
            console.error('保存到 Gitee 失败:', result.error);
        }
    } catch (error) {
        console.error('保存到 Gitee 出错:', error);
    } finally {
        isSavingToGitee = false;
    }
}

// 上传数据到 Gitee
async function uploadToGitee(data) {
    const { token, owner, repo, path } = giteeConfig;
    
    try {
        // 获取文件 SHA（如果文件存在）
        const sha = await getGiteeFileSHA(owner, repo, path, token);
        
        // 根据文件是否存在选择 HTTP 方法
        const method = sha ? 'PUT' : 'POST';
        
        const response = await fetch(`https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${path}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                access_token: token,
                message: `自动保存: ${new Date().toLocaleString()}`,
                content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
                sha: sha
            })
        });
        
        if (response.ok) {
            return { success: true };
        } else {
            const error = await response.json();
            return { success: false, error: error.message || '上传失败' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 获取 Gitee 文件 SHA
async function getGiteeFileSHA(owner, repo, path, token) {
    try {
        const response = await fetch(`https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${path}?access_token=${token}`);
        
        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
    } catch (error) {
        // 文件不存在，返回 null
    }
    return null;
}

// 显示 Gitee 配置对话框
function showGiteeConfig() {
    const modal = document.getElementById('modal');
    const modalContent = `
        <div class="gitee-config">
            <h3><i class="fab fa-gitee"></i> Gitee 自动保存配置</h3>
            <div class="config-info">
                <p>配置后，所有笔记将自动保存到您的 Gitee 仓库，无需手动同步！</p>
            </div>
            <div class="form-group">
                <label for="gitee-owner">仓库所有者:</label>
                <input type="text" id="gitee-owner" placeholder="例如: your-username" value="${giteeConfig.owner || ''}">
                <small>您的 Gitee 用户名</small>
            </div>
            <div class="form-group">
                <label for="gitee-repo">仓库名:</label>
                <input type="text" id="gitee-repo" placeholder="例如: notebook-data" value="${giteeConfig.repo || ''}">
                <small>存储数据的仓库名称</small>
            </div>
            <div class="form-group">
                <label for="gitee-token">访问令牌:</label>
                <input type="password" id="gitee-token" placeholder="输入您的 Gitee Personal Access Token" value="${giteeConfig.token || ''}">
                <small>在 Gitee 设置中生成 Personal Access Token</small>
            </div>
            <div class="form-group">
                <label for="gitee-path">文件路径:</label>
                <input type="text" id="gitee-path" placeholder="例如: notebook-data.json" value="${giteeConfig.path || 'notebook-data.json'}">
                <small>数据文件在仓库中的路径</small>
            </div>
            <div class="config-actions">
                <button class="btn btn-primary" onclick="saveGiteeConfig()">
                    <i class="fas fa-save"></i> 保存配置
                </button>
                <button class="btn btn-success" onclick="testGiteeConnection()">
                    <i class="fas fa-plug"></i> 测试连接
                </button>
                <button class="btn btn-info" onclick="loadFromGitee()">
                    <i class="fas fa-download"></i> 从 Gitee 加载
                </button>
                <button class="btn btn-secondary" onclick="closeModal()">
                    <i class="fas fa-times"></i> 关闭
                </button>
            </div>
            <div class="config-status">
                <p><strong>自动保存状态:</strong> ${giteeConfig.enabled ? '已启用' : '未启用'}</p>
                ${giteeConfig.enabled ? `<p><strong>仓库:</strong> ${giteeConfig.owner}/${giteeConfig.repo}</p>` : ''}
            </div>
        </div>
    `;
    
    modal.innerHTML = modalContent;
    modal.style.display = 'flex';
}

// 保存 Gitee 配置
function saveGiteeConfig() {
    const owner = document.getElementById('gitee-owner').value.trim();
    const repo = document.getElementById('gitee-repo').value.trim();
    const token = document.getElementById('gitee-token').value.trim();
    const path = document.getElementById('gitee-path').value.trim();
    
    if (!owner || !repo || !token) {
        showNotification('请填写完整的配置信息！', 'error');
        return;
    }
    
    giteeConfig = {
        enabled: true,
        owner: owner,
        repo: repo,
        token: token,
        path: path || 'notebook-data.json'
    };
    
    localStorage.setItem('giteeConfig', JSON.stringify(giteeConfig));
    showNotification('Gitee 自动保存配置已保存！', 'success');
    closeModal();
}

// 测试 Gitee 连接
async function testGiteeConnection() {
    if (!giteeConfig.enabled) {
        showNotification('请先保存配置！', 'warning');
        return;
    }
    
    showNotification('正在测试连接...', 'info');
    
    try {
        const testData = {
            test: true,
            timestamp: new Date().toISOString()
        };
        
        const result = await uploadToGitee(testData);
        
        if (result.success) {
            showNotification('Gitee 连接测试成功！', 'success');
        } else {
            showNotification('连接测试失败: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('连接测试失败: ' + error.message, 'error');
    }
}

// 从 Gitee 加载数据
async function loadFromGitee(showNotification = true) {
    if (!giteeConfig.enabled) {
        if (showNotification) {
            showNotification('Gitee 自动保存未启用！', 'warning');
        }
        return;
    }
    
    if (showNotification) {
        showNotification('正在从 Gitee 加载数据...', 'info');
    }
    
    try {
        const { owner, repo, path, token } = giteeConfig;
        
        const response = await fetch(`https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${path}?access_token=${token}`);
        
        if (response.ok) {
            const data = await response.json();
            const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
            
            if (content.notes) {
                // 合并数据
                notes = { ...notes, ...content.notes };
                categories = [...new Set([...categories, ...content.categories])];
                
                if (content.theme) currentTheme = content.theme;
                if (content.lastEditedNote) lastEditedNote = content.lastEditedNote;
                
                // 保存到本地
                saveNotes();
                saveCategories();
                localStorage.setItem('theme', currentTheme);
                const currentUser = localStorage.getItem('notebook_current_user');
        if (currentUser) {
            localStorage.setItem(`lastEditedNote_${currentUser}`, lastEditedNote);
        }
                
                // 更新界面
                loadNotes();
                updateCategorySelect();
                applyTheme(currentTheme);
                
                if (showNotification) {
                    showNotification('数据加载成功！', 'success');
                }
            } else {
                if (showNotification) {
                    showNotification('Gitee 中没有找到有效数据', 'warning');
                }
            }
        } else {
            if (showNotification) {
                showNotification('加载失败，请检查配置', 'error');
            }
        }
    } catch (error) {
        if (showNotification) {
            showNotification('加载失败: ' + error.message, 'error');
        }
    }
}

// 创建新笔记
function createNewNote() {
    const noteId = 'note_' + Date.now();
    const newNote = {
        id: noteId,
        title: '新笔记',
        content: '',
        category: currentCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        backgroundColor: '#ffffff'
    };
    
    console.log('创建新笔记:', noteId, newNote);
    notes[noteId] = newNote;
    currentNote = noteId;
    
    // 保存为最后编辑的笔记
    const currentUser = localStorage.getItem('notebook_current_user');
    if (currentUser) {
        localStorage.setItem(`lastEditedNote_${currentUser}`, noteId);
    }
    lastEditedNote = noteId;
    
    // 清空并更新UI
    document.getElementById('note-title').value = '新笔记';
    document.getElementById('editor').innerHTML = '';
    
    // 更新分类显示
    updateCategoryDisplay(currentCategory);
    
    // 更新左侧分类选择状态
    updateLeftSidebarCategorySelection(currentCategory);
    
    // 重置背景色
    document.getElementById('editor').style.backgroundColor = '#ffffff';
    
    // 清除所有笔记的活动状态
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 保存新笔记
    saveNotes();
    
    // 重新加载笔记列表
    loadNotes();
    
    // 确保当前分类展开
    const categoryNotes = document.getElementById(`notes-${currentCategory}`);
    if (categoryNotes && !categoryNotes.classList.contains('expanded')) {
        toggleCategory(currentCategory);
    }
    
    // 聚焦到标题输入框并选中文字
    const titleInput = document.getElementById('note-title');
    titleInput.focus();
    titleInput.select();
    
    // 显示保存状态
    updateSaveStatus('saved');
    
    showNotification(`新笔记已创建在"${currentCategory}"分类下！`, 'success');
}

// 加载笔记
function loadNote(noteId) {
    if (!notes[noteId]) return;
    
    currentNote = noteId;
    const note = notes[noteId];
    
    // 保存为最后编辑的笔记
    const currentUser = localStorage.getItem('notebook_current_user');
    if (currentUser) {
        localStorage.setItem(`lastEditedNote_${currentUser}`, noteId);
    }
    lastEditedNote = noteId;
    
    // 更新UI
    document.getElementById('note-title').value = note.title || '';
    document.getElementById('editor').innerHTML = note.content || '';
    
    // 更新分类显示
    updateCategoryDisplay(note.category || '默认');
    
    // 应用背景色
    if (note.backgroundColor) {
        document.getElementById('editor').style.backgroundColor = note.backgroundColor;
    } else {
        document.getElementById('editor').style.backgroundColor = '#ffffff';
    }
    
    // 更新活动状态
    document.querySelectorAll('.note-item').forEach(item => {
        item.classList.remove('active');
    });
    const noteItem = document.querySelector(`[data-note-id="${noteId}"]`);
    if (noteItem) {
        noteItem.classList.add('active');
    }
    
    // 更新左侧分类选择状态，使其与右侧保持一致
    updateLeftSidebarCategorySelection(note.category || '默认');
    
    // 显示保存状态
    updateSaveStatus('saved');
}

// 防抖自动保存
function debouncedAutoSave() {
    // 清除之前的定时器
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    
    // 显示保存中状态
    updateSaveStatus('saving');
    
    // 设置新的定时器，500ms后执行保存
    autoSaveTimer = setTimeout(() => {
        autoSave();
    }, 500);
}

// 自动保存
function autoSave() {
    if (isAutoSaving) return;
    
    isAutoSaving = true;
    
    try {
        if (!currentNote) {
            // 只有在有实际内容时才创建新笔记
            const title = document.getElementById('note-title').value.trim();
            const content = document.getElementById('editor').innerHTML.trim();
            
            if (title || content) {
                createNewNote();
            } else {
                isAutoSaving = false;
                return;
            }
        }
        
        const note = notes[currentNote];
        if (note) {
            // 优先使用currentCategory，确保分类正确
            const categoryDisplay = document.getElementById('category-display');
            const newCategory = currentCategory || (categoryDisplay ? categoryDisplay.textContent : '默认');
            const categoryChanged = note.category !== newCategory;
            
            note.title = document.getElementById('note-title').value;
            note.content = document.getElementById('editor').innerHTML;
            note.category = newCategory;
            note.updatedAt = new Date().toISOString();
            
            // 更新最后编辑的笔记
            localStorage.setItem('lastEditedNote', currentNote);
            lastEditedNote = currentNote;
            
            saveNotes();
            updateNoteInList(currentNote);
            
            // 如果分类发生变化，需要重新加载笔记列表
            if (categoryChanged) {
                // 延迟重新加载，避免在自动保存过程中重复触发
                setTimeout(() => {
                    loadNotes();
                }, 100);
            }
            
            // 显示保存成功状态
            updateSaveStatus('saved');
            
            // 触发自动保存到 Supabase
            autoSaveToSupabase();
        }
    } catch (error) {
        console.error('自动保存失败:', error);
        updateSaveStatus('error');
    } finally {
        isAutoSaving = false;
    }
}

// 更新保存状态显示
function updateSaveStatus(status) {
    const saveStatus = document.getElementById('save-status');
    const icon = saveStatus.querySelector('i');
    const text = saveStatus.querySelector('span');
    
    // 移除所有状态类
    saveStatus.classList.remove('saved', 'saving', 'error');
    
    switch(status) {
        case 'saving':
            saveStatus.classList.add('saving');
            icon.className = 'fas fa-spinner';
            text.textContent = '保存中...';
            break;
        case 'saved':
            saveStatus.classList.add('saved');
            icon.className = 'fas fa-check-circle';
            text.textContent = '已保存';
            // 2秒后隐藏状态
            setTimeout(() => {
                if (saveStatus.classList.contains('saved')) {
                    saveStatus.style.opacity = '0.7';
                }
            }, 2000);
            break;
        case 'error':
            saveStatus.classList.add('error');
            icon.className = 'fas fa-exclamation-triangle';
            text.textContent = '保存失败';
            break;
    }
}

// 保存笔记
function saveNote() {
    if (!currentNote) {
        createNewNote();
        return;
    }
    
    // 显示保存中状态
    updateSaveStatus('saving');
    
    // 立即保存
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    
    autoSave();
    showNotification('笔记已保存！', 'success');
}

// 保存所有笔记数据
function saveNotes() {
    const currentUser = localStorage.getItem('notebook_current_user');
    if (currentUser) {
        localStorage.setItem(`notes_${currentUser}`, JSON.stringify(notes));
    }
}

// 更新笔记列表中的显示
function updateNoteInList(noteId) {
    const note = notes[noteId];
    const noteItem = document.querySelector(`[data-note-id="${noteId}"]`);
    
    if (noteItem) {
        const titleElement = noteItem.querySelector('h4');
        const previewElement = noteItem.querySelector('p');
        
        titleElement.textContent = note.title || '无标题';
        previewElement.textContent = getNotePreview(note.content);
    }
}

// 删除笔记
async function deleteNote(noteId) {
    if (confirm('确定要删除这个笔记吗？')) {
        console.log('开始删除笔记:', noteId);
        
        // 从本地删除
        delete notes[noteId];
        saveNotes();
        console.log('本地笔记已删除');
        
        // 从 Supabase 数据库中删除
        if (supabase) {
            try {
                console.log('尝试从 Supabase 删除笔记:', noteId);
                
                const { data, error } = await supabase
                    .from('notes')
                    .delete()
                    .eq('id', noteId)
                    .select();
                
                console.log('删除操作结果:', { data, error });
                
                if (error) {
                    console.error('从数据库删除笔记失败:', error);
                    showNotification(`数据库删除失败: ${error.message}`, 'error');
                    
                    if (error.code === 'PGRST301') {
                        showNotification('权限不足，请检查 Supabase RLS 策略', 'error');
                    } else if (error.code === 'PGRST116') {
                        showNotification('笔记在数据库中不存在', 'warning');
                    }
                } else {
                    console.log('笔记已从数据库删除:', data);
                    showNotification('笔记已完全删除！', 'success');
                }
            } catch (error) {
                console.error('删除笔记时出错:', error);
                showNotification(`删除出错: ${error.message}`, 'error');
            }
        } else {
            console.error('Supabase 客户端未初始化');
            showNotification('Supabase 未初始化，仅本地删除', 'warning');
        }
        
        // 如果删除的是最后编辑的笔记，清除记录
        if (lastEditedNote === noteId) {
            localStorage.removeItem('lastEditedNote');
            lastEditedNote = null;
        }
        
        loadNotes();
        
        if (currentNote === noteId) {
            currentNote = null;
            document.getElementById('note-title').value = '';
            document.getElementById('editor').innerHTML = '';
            document.getElementById('editor').style.backgroundColor = '#ffffff';
        }
        
        // 刷新使用量显示
        updateUsageDisplay();
    }
}

// 富文本编辑功能
function toggleBold() {
    document.execCommand('bold');
    updateToolbarState();
}

function toggleItalic() {
    document.execCommand('italic');
    updateToolbarState();
}

function toggleUnderline() {
    document.execCommand('underline');
    updateToolbarState();
}

function changeFontSize() {
    showFontSelector();
}

function changeTextColor() {
    document.getElementById('color-picker').click();
}

function applyColor(color) {
    document.execCommand('foreColor', false, color);
    updateToolbarState();
}

function insertImage() {
    const url = prompt('请输入图片URL：');
    if (url && url.trim()) {
        const img = document.createElement('img');
        img.src = url.trim();
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '10px 0';
        
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.setStartAfter(img);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            document.getElementById('editor').appendChild(img);
        }
        
        // 触发自动保存
        debouncedAutoSave();
    }
}

function insertLink() {
    const url = prompt('请输入链接地址：');
    if (url && url.trim()) {
        const text = window.getSelection().toString() || prompt('请输入链接文本：');
        if (text) {
            document.execCommand('createLink', false, url.trim());
            updateToolbarState();
            // 触发自动保存
            debouncedAutoSave();
        }
    }
}

function changeBackground() {
    document.getElementById('bg-color-picker').click();
}

function applyBackgroundColor(color) {
    if (currentNote && notes[currentNote]) {
        notes[currentNote].backgroundColor = color;
        document.getElementById('editor').style.backgroundColor = color;
        saveNotes();
        updateSaveStatus('saved');
        showNotification('背景色已更新！', 'success');
    }
}

// 更新工具栏状态
function updateToolbarState() {
    const buttons = document.querySelectorAll('.tool-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (document.queryCommandState('bold')) {
        document.querySelector('[onclick="toggleBold()"]').classList.add('active');
    }
    if (document.queryCommandState('italic')) {
        document.querySelector('[onclick="toggleItalic()"]').classList.add('active');
    }
    if (document.queryCommandState('underline')) {
        document.querySelector('[onclick="toggleUnderline()"]').classList.add('active');
    }
}

// 生成二维码
function generateQR() {
    if (!currentNote || !notes[currentNote]) {
        showNotification('请先选择一个笔记！', 'warning');
        return;
    }
    
    // 检查 QRCode 库是否加载
    if (typeof QRCode === 'undefined') {
        console.error('QRCode 库未加载，直接使用文本二维码...');
        generateTextQR();
        return;
    }
    
    const note = notes[currentNote];
    const noteData = {
        title: note.title,
        content: note.content,
        category: note.category,
        createdAt: note.createdAt
    };
    
    const dataString = JSON.stringify(noteData);
    const qrContainer = document.createElement('div');
    qrContainer.className = 'qr-container';
    
    const canvas = document.createElement('canvas');
    qrContainer.appendChild(canvas);
    
    try {
        QRCode.toCanvas(canvas, dataString, {
            width: 200,
            height: 200,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        }, function (error) {
            if (error) {
                console.error('二维码生成失败:', error);
                showNotification('二维码生成失败！', 'error');
                return;
            }
            
            const modalBody = document.getElementById('modal-body');
            modalBody.innerHTML = `
                <h3>笔记二维码</h3>
                <p>扫描二维码可以查看笔记内容</p>
                ${qrContainer.outerHTML}
                <button class="copy-btn" onclick="copyQRData()">复制数据</button>
            `;
            
            showModal();
        });
    } catch (error) {
        console.error('二维码生成异常:', error);
        showNotification('二维码生成失败！', 'error');
    }
}

// 使用 API 生成二维码（备用方案）
function generateQRWithAPI() {
    if (!currentNote || !notes[currentNote]) {
        showNotification('请先选择一个笔记！', 'warning');
        return;
    }
    
    const note = notes[currentNote];
    const noteData = {
        title: note.title,
        content: note.content,
        category: note.category,
        createdAt: note.createdAt
    };
    
    const dataString = JSON.stringify(noteData);
    
    // 尝试多个 API 服务
    const apis = [
        `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dataString)}`,
        `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(dataString)}`,
        `https://qr-server.com/api/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dataString)}`
    ];
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <h3>笔记二维码</h3>
        <p>扫描二维码可以查看笔记内容</p>
        <div class="qr-container" style="text-align: center;">
            <div id="qr-loading">正在生成二维码...</div>
            <img id="qr-image" style="display: none; max-width: 200px; height: auto;" onerror="tryNextAPI()">
        </div>
        <button class="copy-btn" onclick="copyQRData()">复制数据</button>
        <button class="copy-btn" onclick="generateTextQR()" style="margin-left: 10px;">文本二维码</button>
    `;
    
    showModal();
    
    // 直接显示文本二维码（避免网络问题）
    setTimeout(() => {
        const qrLoading = document.getElementById('qr-loading');
        if (qrLoading) {
            qrLoading.innerHTML = '网络连接失败，显示文本二维码：';
            generateTextQR();
        }
    }, 2000);
}

// 下载二维码
function downloadQR() {
    if (!currentNote || !notes[currentNote]) return;
    
    const note = notes[currentNote];
    const noteData = {
        title: note.title,
        content: note.content,
        category: note.category,
        createdAt: note.createdAt
    };
    
    const dataString = JSON.stringify(noteData);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dataString)}`;
    
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qrcode_${note.title || 'note'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('二维码下载成功！', 'success');
}

// 生成可用的二维码
function generateTextQR() {
    if (!currentNote || !notes[currentNote]) {
        showNotification('请先选择一个笔记！', 'warning');
        return;
    }
    
    const note = notes[currentNote];
    const noteData = {
        title: note.title,
        content: note.content,
        category: note.category,
        createdAt: note.createdAt
    };
    
    // 显示当前要分享的笔记信息
    console.log('准备分享笔记:', {
        noteId: currentNote,
        title: note.title,
        content: note.content.substring(0, 50) + '...',
        category: note.category
    });
    
    const dataString = JSON.stringify(noteData);
    
    // 创建分享链接
    createShareUrl(noteData).then(shareUrl => {
        const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <h3>笔记分享</h3>
        <p>选择以下方式分享您的笔记：</p>
        <div class="qr-container" style="text-align: center;">
            <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h4>分享链接：</h4>
                <input type="text" readonly value="${shareUrl}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 12px;" onclick="this.select()">
                <p style="font-size: 12px; color: #666; margin: 10px 0;">点击链接复制，发送给他人即可查看笔记</p>
            </div>
            
            <div style="background: #e8f4fd; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h4>在线生成二维码：</h4>
                <p style="font-size: 14px; margin: 10px 0;">复制上面的链接，然后访问以下网站生成二维码：</p>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                    <a href="https://www.qrcode-monkey.com/" target="_blank" style="background: #007bff; color: white; padding: 8px 16px; border-radius: 5px; text-decoration: none; font-size: 12px;">QR Code Monkey</a>
                    <a href="https://www.qr-code-generator.com/" target="_blank" style="background: #28a745; color: white; padding: 8px 16px; border-radius: 5px; text-decoration: none; font-size: 12px;">QR Code Generator</a>
                    <a href="https://qr.liantu.com/" target="_blank" style="background: #ffc107; color: black; padding: 8px 16px; border-radius: 5px; text-decoration: none; font-size: 12px;">联图网</a>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h4>笔记数据：</h4>
                <textarea readonly style="width: 100%; height: 120px; font-family: monospace; font-size: 11px; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">${dataString}</textarea>
                <p style="font-size: 12px; color: #666; margin: 10px 0;">这是笔记的原始数据，可以用于备份或导入</p>
            </div>
        </div>
        <button class="copy-btn" onclick="copyShareUrl()">复制分享链接</button>
        <button class="copy-btn" onclick="copyQRData()" style="margin-left: 10px;">复制数据</button>
    `;
    
    showModal();
    }).catch(error => {
        console.error('创建分享链接失败:', error);
        showNotification('创建分享链接失败', 'error');
    });
}

// 创建分享链接（优化版本）
async function createShareUrl(noteData) {
    try {
        // 生成短分享ID
        const shareId = generateShareId();
        
        // 将分享数据存储到数据库
        if (supabase) {
            console.log('尝试保存分享数据到数据库...', { shareId, noteData });
            
            const { error } = await supabase
                .from('shared_notes')
                .insert({
                    id: shareId,
                    note_data: noteData,
                    created_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30天后过期
                });
            
            if (error) {
                console.error('保存分享数据失败:', error);
                console.log('回退到长链接方式');
                // 如果数据库保存失败，回退到原来的方式
                return createShareUrlFallback(noteData);
            } else {
                console.log('分享数据保存成功');
            }
        } else {
            console.log('Supabase 不可用，回退到长链接方式');
            // 如果 Supabase 不可用，回退到原来的方式
            return createShareUrlFallback(noteData);
        }
        
        // 返回短链接
        const shortUrl = `${window.location.origin}${window.location.pathname}?share=${shareId}`;
        console.log('生成短链接:', shortUrl);
        return shortUrl;
        
    } catch (error) {
        console.error('创建分享链接失败:', error);
        // 出错时回退到原来的方式
        return createShareUrlFallback(noteData);
    }
}

// 回退方案：原来的长链接方式
function createShareUrlFallback(noteData) {
    const encodedData = encodeURIComponent(JSON.stringify(noteData));
    return `${window.location.origin}${window.location.pathname}?import=${encodedData}`;
}

// 生成短分享ID
function generateShareId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 复制分享链接
async function copyShareUrl() {
    if (!currentNote || !notes[currentNote]) return;
    
    const note = notes[currentNote];
    const noteData = {
        title: note.title,
        content: note.content,
        category: note.category,
        createdAt: note.createdAt
    };
    
    // 显示当前要分享的笔记信息
    console.log('准备分享笔记:', {
        noteId: currentNote,
        title: note.title,
        content: note.content.substring(0, 50) + '...',
        category: note.category
    });
    
    try {
        const shareUrl = await createShareUrl(noteData);
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            showNotification('分享链接已复制到剪贴板！', 'success');
        }).catch(() => {
            showNotification('复制失败，请手动复制！', 'error');
        });
    } catch (error) {
        console.error('创建分享链接失败:', error);
        showNotification('创建分享链接失败', 'error');
    }
}

// 创建简单的文本二维码
function createTextQR(text) {
    // 简单的文本二维码生成（ASCII 艺术）
    const lines = [];
    const width = 40;
    const height = 20;
    
    // 创建边框
    lines.push('█'.repeat(width + 2));
    
    // 添加内容行
    for (let i = 0; i < height; i++) {
        let line = '█';
        for (let j = 0; j < width; j++) {
            // 简单的模式生成
            const charIndex = (i * width + j) % text.length;
            const charCode = text.charCodeAt(charIndex);
            line += (charCode % 2 === 0) ? '█' : ' ';
        }
        line += '█';
        lines.push(line);
    }
    
    lines.push('█'.repeat(width + 2));
    
    return lines.join('\n');
}

// 复制文本二维码
function copyTextQR() {
    if (!currentNote || !notes[currentNote]) return;
    
    const note = notes[currentNote];
    const noteData = {
        title: note.title,
        content: note.content,
        category: note.category,
        createdAt: note.createdAt
    };
    
    const dataString = JSON.stringify(noteData);
    const qrText = createTextQR(dataString);
    
    navigator.clipboard.writeText(qrText).then(() => {
        showNotification('文本二维码已复制到剪贴板！', 'success');
    }).catch(() => {
        showNotification('复制失败，请手动复制！', 'error');
    });
}

// 复制二维码数据
function copyQRData() {
    if (!currentNote || !notes[currentNote]) return;
    
    const note = notes[currentNote];
    const noteData = {
        title: note.title,
        content: note.content,
        category: note.category,
        createdAt: note.createdAt
    };
    
    const dataString = JSON.stringify(noteData, null, 2);
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(dataString).then(() => {
            showNotification('数据已复制到剪贴板！', 'success');
        });
    } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = dataString;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('数据已复制到剪贴板！', 'success');
    }
}

// 分享笔记
function shareNote() {
    if (!currentNote || !notes[currentNote]) {
        showNotification('请先选择一个笔记！', 'warning');
        return;
    }
    
    const note = notes[currentNote];
    const shareUrl = generateShareUrl(note);
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <h3>分享笔记</h3>
        <p>复制以下链接分享给其他人：</p>
        <div class="share-link">${shareUrl}</div>
        <button class="copy-btn" onclick="copyShareUrl()">复制链接</button>
        <button class="copy-btn" onclick="generateQR()" style="margin-left: 10px;">生成二维码</button>
    `;
    
    showModal();
}

// 生成分享链接
function generateShareUrl(note) {
    const baseUrl = window.location.origin + window.location.pathname;
    const noteData = encodeURIComponent(JSON.stringify({
        title: note.title,
        content: note.content,
        category: note.category,
        createdAt: note.createdAt
    }));
    
    return `${baseUrl}?share=${noteData}`;
}

// 复制分享链接
function copyShareUrl() {
    const shareLink = document.querySelector('.share-link').textContent;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareLink).then(() => {
            showNotification('链接已复制到剪贴板！', 'success');
        });
    } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = shareLink;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('链接已复制到剪贴板！', 'success');
    }
}

// 显示模态框
function showModal() {
    document.getElementById('modal').style.display = 'block';
}

// 关闭模态框
function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// 移动端侧边栏切换
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 3000;
        animation: slideInRight 0.3s ease;
    `;
    
    // 根据类型设置颜色
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#000';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 调试函数：显示当前笔记的分类信息
function debugNoteCategory() {
    if (currentNote && notes[currentNote]) {
        const note = notes[currentNote];
        const categorySelect = document.getElementById('note-category');
        
        console.log('=== 笔记分类调试信息 ===');
        console.log('当前笔记ID:', currentNote);
        console.log('笔记标题:', note.title);
        console.log('笔记分类:', note.category);
        console.log('当前分类变量:', currentCategory);
        console.log('下拉菜单值:', categorySelect.value);
        console.log('所有分类:', categories);
        console.log('========================');
        
        showNotification(`调试信息已输出到控制台`, 'info');
    } else {
        showNotification('没有当前笔记', 'warning');
    }
}

// 修复函数：强制更新当前笔记的分类
function fixNoteCategory() {
    if (currentNote && notes[currentNote]) {
        const note = notes[currentNote];
        const categorySelect = document.getElementById('note-category');
        const newCategory = categorySelect.value;
        
        // 强制更新笔记分类
        note.category = newCategory;
        note.updatedAt = new Date().toISOString();
        
        // 更新当前分类变量
        currentCategory = newCategory;
        
        // 保存数据
        saveNotes();
        
        // 重新加载列表
        loadNotes();
        
        showNotification(`笔记分类已修复为"${newCategory}"`, 'success');
    } else {
        showNotification('没有当前笔记', 'warning');
    }
}

// 修复分类数据：检查并修复所有分类相关的问题
function fixCategoryData() {
    console.log('=== 开始修复分类数据 ===');
    
    // 1. 检查并修复分类数组
    const allNoteCategories = [...new Set(Object.values(notes).map(note => note.category).filter(Boolean))];
    const missingCategories = allNoteCategories.filter(cat => !categories.includes(cat));
    
    if (missingCategories.length > 0) {
        console.log('发现缺失的分类:', missingCategories);
        categories = [...new Set([...categories, ...missingCategories])];
        saveCategories();
        showNotification(`已添加缺失的分类: ${missingCategories.join(', ')}`, 'success');
    }
    
    // 2. 检查并修复笔记分类（只修复真正有问题的笔记）
    let fixedNotes = 0;
    Object.values(notes).forEach(note => {
        // 只修复没有分类的笔记，不要重置已有的分类
        if (!note.category) {
            note.category = '默认';
            note.updatedAt = new Date().toISOString();
            fixedNotes++;
        }
    });
    
    if (fixedNotes > 0) {
        saveNotes();
        showNotification(`已修复 ${fixedNotes} 个笔记的分类`, 'success');
    }
    
    // 3. 更新UI
    loadNotes();
    updateCategorySelect();
    
    console.log('当前所有分类:', categories);
    console.log('=== 分类数据修复完成 ===');
    
    if (missingCategories.length > 0 || fixedNotes > 0) {
        showNotification('分类数据修复完成！', 'success');
    }
}

// 恢复笔记分类：根据笔记标题或内容推断正确的分类
function restoreNoteCategories() {
    console.log('=== 开始恢复笔记分类 ===');
    console.log('注意：此函数已被禁用，因为它会错误地移动笔记分类');
    console.log('如果您需要恢复特定的笔记分类，请使用 moveNoteToCategory() 函数');
    
    showNotification('恢复功能已禁用，请使用其他方法修复分类', 'warning');
    console.log('=== 笔记分类恢复完成 ===');
}

// 将指定笔记移动到指定分类
function moveNoteToCategory(noteId, targetCategory) {
    if (!notes[noteId]) {
        showNotification('找不到指定的笔记', 'error');
        return;
    }
    
    const note = notes[noteId];
    const oldCategory = note.category;
    
    // 更新笔记分类
    note.category = targetCategory;
    note.updatedAt = new Date().toISOString();
    
    // 确保目标分类存在
    if (!categories.includes(targetCategory)) {
        categories.push(targetCategory);
        saveCategories();
    }
    
    // 保存数据
    saveNotes();
    
    // 重新加载界面
    loadNotes();
    updateCategorySelect();
    
    showNotification(`笔记"${note.title}"已从"${oldCategory}"移动到"${targetCategory}"`, 'success');
    console.log(`笔记"${note.title}"已从"${oldCategory}"移动到"${targetCategory}"`);
}

// 将当前笔记移动到指定分类
function moveCurrentNoteToCategory(targetCategory) {
    if (!currentNote) {
        showNotification('没有当前笔记', 'warning');
        return;
    }
    
    moveNoteToCategory(currentNote, targetCategory);
}

// 检查并修复被错误移动的笔记分类
function fixIncorrectlyMovedNotes() {
    console.log('=== 检查被错误移动的笔记 ===');
    
    let fixedNotes = 0;
    const incorrectlyMovedNotes = [];
    
    Object.values(notes).forEach(note => {
        // 检查标题不包含"节点"但分类是"节点"的笔记
        if (note.title && !note.title.includes('节点') && note.category === '节点') {
            incorrectlyMovedNotes.push({
                id: note.id,
                title: note.title,
                currentCategory: note.category,
                shouldBeCategory: '默认'
            });
        }
    });
    
    console.log('发现可能被错误移动的笔记:', incorrectlyMovedNotes);
    
    if (incorrectlyMovedNotes.length > 0) {
        // 询问用户是否要修复
        const confirmMessage = `发现 ${incorrectlyMovedNotes.length} 个笔记可能被错误移动到"节点"分类：\n${incorrectlyMovedNotes.map(n => `- "${n.title}"`).join('\n')}\n\n是否要将它们移回"默认"分类？`;
        
        if (confirm(confirmMessage)) {
            incorrectlyMovedNotes.forEach(noteInfo => {
                const note = notes[noteInfo.id];
                note.category = '默认';
                note.updatedAt = new Date().toISOString();
                fixedNotes++;
                console.log(`修复笔记"${note.title}"的分类为"默认"`);
            });
            
            if (fixedNotes > 0) {
                saveNotes();
                loadNotes();
                updateCategorySelect();
                showNotification(`已修复 ${fixedNotes} 个笔记的分类`, 'success');
            }
        }
    } else {
        showNotification('没有发现被错误移动的笔记', 'info');
    }
    
    console.log('=== 笔记分类检查完成 ===');
}

// 调试分类数据状态
function debugCategories() {
    console.log('=== 分类数据调试信息 ===');
    console.log('当前分类数组:', categories);
    console.log('分类数组长度:', categories.length);
    console.log('localStorage中的分类:', JSON.parse(localStorage.getItem('categories') || '[]'));
    
    // 检查所有笔记的分类
    const allNoteCategories = [...new Set(Object.values(notes).map(note => note.category).filter(Boolean))];
    console.log('笔记中使用的所有分类:', allNoteCategories);
    
    // 检查分类选择器
    const select = document.getElementById('note-category');
    if (select) {
        console.log('分类选择器元素:', select);
        console.log('选择器选项数量:', select.options.length);
        console.log('选择器当前值:', select.value);
        console.log('选择器所有选项:', Array.from(select.options).map(opt => opt.value));
    } else {
        console.error('找不到分类选择器元素');
    }
    
    // 检查左侧分类列表
    const categoryElements = document.querySelectorAll('.category');
    console.log('左侧分类元素数量:', categoryElements.length);
    categoryElements.forEach((el, index) => {
        console.log(`分类元素 ${index}:`, el.getAttribute('data-category'));
    });
    
    console.log('=== 分类数据调试完成 ===');
    showNotification('分类调试信息已输出到控制台', 'info');
}

// 强制刷新分类数据
function refreshCategories() {
    console.log('=== 强制刷新分类数据 ===');
    
    // 重新从localStorage加载分类数据
    const storedCategories = JSON.parse(localStorage.getItem('categories') || '["默认"]');
    console.log('从localStorage加载的分类:', storedCategories);
    
    // 检查笔记中使用的所有分类
    const allNoteCategories = [...new Set(Object.values(notes).map(note => note.category).filter(Boolean))];
    console.log('笔记中使用的所有分类:', allNoteCategories);
    
    // 合并分类数据
    const mergedCategories = [...new Set([...storedCategories, ...allNoteCategories])];
    console.log('合并后的分类:', mergedCategories);
    
    // 更新分类数组
    categories = mergedCategories;
    saveCategories();
    
    // 重新加载界面
    loadNotes();
    updateCategorySelect();
    
    showNotification('分类数据已刷新！', 'success');
    console.log('=== 分类数据刷新完成 ===');
}

// 处理分享链接
async function handleShareUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    const importData = urlParams.get('import'); // 兼容旧的长链接格式
    
    if (shareId) {
        // 处理新的短链接格式
        try {
            if (supabase) {
                const { data, error } = await supabase
                    .from('shared_notes')
                    .select('note_data')
                    .eq('id', shareId)
                    .gt('expires_at', new Date().toISOString())
                    .single();
                
                if (error || !data) {
                    showNotification('分享链接已过期或不存在！', 'error');
                    return;
                }
                
                const noteData = data.note_data;
                
                // 显示导入确认对话框
                const confirmImport = confirm(`发现分享的笔记："${noteData.title}"\n\n是否要导入到你的笔记本中？`);
                if (confirmImport) {
                    await importSharedNote(noteData);
                    
                    // 更新访问计数
                    await supabase.rpc('increment_access_count', { share_id: shareId });
                } else {
                    // 用户选择不导入，清除URL参数
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }
                
            } else {
                showNotification('无法加载分享内容，请稍后重试', 'error');
            }
        } catch (error) {
            console.error('加载分享内容失败:', error);
            showNotification('分享链接无效！', 'error');
        }
    } else if (importData) {
        // 处理旧的长链接格式（兼容性）
        try {
            const noteData = JSON.parse(decodeURIComponent(importData));
            
            // 显示导入确认对话框
            const confirmImport = confirm(`发现分享的笔记："${noteData.title}"\n\n是否要导入到你的笔记本中？`);
            if (confirmImport) {
                await importSharedNote(noteData);
            } else {
                // 用户选择不导入，清除URL参数
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }
        } catch (error) {
            console.error('解析分享数据失败:', error);
            showNotification('分享链接无效！', 'error');
        }
    }
    
    // 清除URL参数
    if (shareId || importData) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// 导入分享的笔记
async function importSharedNote(noteData) {
    // 创建新笔记
    const noteId = 'shared_' + Date.now();
    const newNote = {
        id: noteId,
        title: noteData.title || '分享的笔记',
        content: noteData.content || '',
        category: noteData.category || '默认',
        createdAt: noteData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        backgroundColor: noteData.backgroundColor || '#ffffff'
    };
    
    notes[noteId] = newNote;
    saveNotes();
    
    // 同步到数据库
    if (typeof saveToSupabase === 'function') {
        try {
            await saveToSupabase();
        } catch (error) {
            console.error('同步到数据库失败:', error);
        }
    }
    
    // 加载笔记到编辑器
    loadNote(noteId);
    loadNotes();
    
    // 确保编辑器显示正确的内容
    setTimeout(() => {
        const titleInput = document.getElementById('note-title');
        const contentDiv = document.getElementById('note-content');
        
        if (titleInput) {
            titleInput.value = newNote.title;
            console.log('设置标题:', newNote.title);
        }
        
        if (contentDiv) {
            contentDiv.innerHTML = newNote.content;
            console.log('设置内容:', newNote.content.substring(0, 100) + '...');
        }
        
        // 强制更新当前选中的笔记
        currentNoteId = noteId;
        
        // 更新笔记选择器
        const noteSelector = document.getElementById('note-selector');
        if (noteSelector) {
            noteSelector.value = noteId;
        }
        
        console.log('分享笔记已加载:', {
            noteId: noteId,
            title: newNote.title,
            content: newNote.content.substring(0, 100) + '...',
            currentNoteId: currentNoteId
        });
    }, 200);
    
    showNotification('已导入分享的笔记！', 'success');
}

// 页面加载完成后处理分享链接 - 已禁用自动导入
// document.addEventListener('DOMContentLoaded', function() {
//     setTimeout(handleShareUrl, 1000);
// });

// 手动检查分享链接
async function checkForSharedNote() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    const importData = urlParams.get('import');
    
    if (!shareId && !importData) {
        showNotification('当前页面没有分享链接', 'info');
        return;
    }
    
    // 如果是短链接，先检查数据库中的数据
    if (shareId) {
        try {
            console.log('检查分享ID:', shareId);
            const { data, error } = await supabase
                .from('shared_notes')
                .select('*')
                .eq('id', shareId)
                .single();
            
            if (error) {
                console.error('查询分享数据失败:', error);
                showNotification('分享链接不存在或已过期', 'error');
                return;
            }
            
            if (data) {
                console.log('找到分享数据:', data);
                console.log('笔记标题:', data.note_data.title);
                console.log('笔记内容:', data.note_data.content);
                console.log('创建时间:', data.created_at);
                console.log('过期时间:', data.expires_at);
                
                // 显示详细信息
                const info = `分享ID: ${shareId}\n标题: ${data.note_data.title}\n创建时间: ${new Date(data.created_at).toLocaleString()}\n过期时间: ${new Date(data.expires_at).toLocaleString()}\n访问次数: ${data.access_count}`;
                alert(info);
                
                // 直接处理导入，不调用 handleShareUrl
                const confirmImport = confirm(`发现分享的笔记："${data.note_data.title}"\n\n是否要导入到你的笔记本中？`);
                if (confirmImport) {
                    await importSharedNote(data.note_data);
                    
                    // 更新访问计数
                    await supabase.rpc('increment_access_count', { share_id: shareId });
                    
                    // 清除URL参数
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
        } catch (error) {
            console.error('检查分享数据失败:', error);
        }
    } else if (importData) {
        // 处理旧的长链接格式
        try {
            const noteData = JSON.parse(decodeURIComponent(importData));
            
            // 显示导入确认对话框
            const confirmImport = confirm(`发现分享的笔记："${noteData.title}"\n\n是否要导入到你的笔记本中？`);
            if (confirmImport) {
                await importSharedNote(noteData);
                
                // 清除URL参数
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error('解析分享数据失败:', error);
            showNotification('分享链接无效！', 'error');
        }
    }
}

// 主题切换功能
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    localStorage.setItem('theme', currentTheme);
    
    // 更新主题按钮图标
    const themeBtn = document.querySelector('[onclick="toggleTheme()"] i');
    themeBtn.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    
    showNotification(`已切换到${currentTheme === 'light' ? '浅色' : '深色'}主题`, 'success');
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // 更新主题按钮图标
    const themeBtn = document.querySelector('[onclick="toggleTheme()"] i');
    if (themeBtn) {
        themeBtn.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// 导出笔记功能
function exportNotes() {
    if (Object.keys(notes).length === 0) {
        showNotification('没有笔记可以导出！', 'warning');
        return;
    }
    
    const exportData = {
        notes: notes,
        categories: categories,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `notebook_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('笔记已导出！', 'success');
}

// ==================== 备份恢复功能 ====================

// 备份所有数据（包括用户信息、笔记、分类、设置等）
function backupAllData() {
    const currentUser = localStorage.getItem('notebook_current_user');
    if (!currentUser) {
        showNotification('请先登录！', 'error');
        return;
    }
    
    if (Object.keys(notes).length === 0 && categories.length === 0) {
        showNotification('没有数据可以备份！', 'warning');
        return;
    }
    
    try {
        // 收集所有需要备份的数据
        const backupData = {
            // 基本信息
            user: currentUser,
            backupDate: new Date().toISOString(),
            version: '2.0.0',
            backupType: 'full_backup',
            
            // 笔记数据
            notes: notes,
            categories: categories,
            lastEditedNote: lastEditedNote,
            
            // 用户设置
            settings: {
                theme: currentTheme,
                fontSize: document.documentElement.style.fontSize || '16px',
                fontFamily: document.documentElement.style.fontFamily || 'Arial, sans-serif'
            },
            
            // 统计信息
            statistics: {
                totalNotes: Object.keys(notes).length,
                totalCategories: categories.length,
                backupSize: JSON.stringify(notes).length + JSON.stringify(categories).length
            }
        };
        
        // 生成备份文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const filename = `notebook_full_backup_${currentUser}_${timestamp}.json`;
        
        // 创建并下载备份文件
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 显示备份成功信息
        const stats = backupData.statistics;
        showNotification(`备份成功！包含 ${stats.totalNotes} 条笔记，${stats.totalCategories} 个分类`, 'success');
        
        console.log('备份完成:', {
            user: currentUser,
            notes: stats.totalNotes,
            categories: stats.totalCategories,
            size: Math.round(stats.backupSize / 1024) + ' KB'
        });
        
    } catch (error) {
        console.error('备份失败:', error);
        showNotification('备份失败: ' + error.message, 'error');
    }
}

// 从备份文件恢复数据
function restoreFromBackup() {
    const currentUser = localStorage.getItem('notebook_current_user');
    if (!currentUser) {
        showNotification('请先登录！', 'error');
        return;
    }
    
    // 确认恢复操作
    if (!confirm('恢复备份将覆盖当前所有数据，确定要继续吗？\n\n建议先备份当前数据！')) {
        return;
    }
    
    // 创建文件输入元素
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const backupData = JSON.parse(e.target.result);
                
                // 验证备份文件格式
                if (!validateBackupFile(backupData)) {
                    showNotification('备份文件格式不正确！', 'error');
                    return;
                }
                
                // 执行恢复操作
                restoreDataFromBackup(backupData, currentUser);
                
            } catch (error) {
                console.error('解析备份文件失败:', error);
                showNotification('备份文件解析失败: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

// 验证备份文件格式
function validateBackupFile(backupData) {
    const requiredFields = ['user', 'backupDate', 'version', 'notes', 'categories'];
    
    for (const field of requiredFields) {
        if (!(field in backupData)) {
            console.error('备份文件缺少必要字段:', field);
            return false;
        }
    }
    
    // 检查数据类型
    if (typeof backupData.notes !== 'object' || !Array.isArray(backupData.categories)) {
        console.error('备份文件数据类型不正确');
        return false;
    }
    
    return true;
}

// 从备份数据恢复
async function restoreDataFromBackup(backupData, currentUser) {
    try {
        showNotification('正在恢复数据...', 'info');
        
        // 1. 恢复笔记数据
        if (backupData.notes && Object.keys(backupData.notes).length > 0) {
            notes = backupData.notes;
            console.log('恢复笔记:', Object.keys(notes).length, '条');
        }
        
        // 2. 恢复分类数据
        if (backupData.categories && backupData.categories.length > 0) {
            categories = backupData.categories;
            console.log('恢复分类:', categories.length, '个');
        }
        
        // 3. 恢复最后编辑的笔记
        if (backupData.lastEditedNote) {
            lastEditedNote = backupData.lastEditedNote;
        }
        
        // 4. 恢复用户设置
        if (backupData.settings) {
            if (backupData.settings.theme) {
                currentTheme = backupData.settings.theme;
                applyTheme(currentTheme);
            }
            if (backupData.settings.fontSize) {
                document.documentElement.style.fontSize = backupData.settings.fontSize;
            }
            if (backupData.settings.fontFamily) {
                document.documentElement.style.fontFamily = backupData.settings.fontFamily;
            }
        }
        
        // 5. 保存到本地存储
        saveNotes();
        saveCategories();
        
        // 6. 保存到 Supabase 数据库
        if (typeof saveToSupabase === 'function') {
            console.log('正在同步到数据库...');
            const result = await saveToSupabase();
            if (result && result.success) {
                console.log('数据已同步到数据库');
            } else {
                console.warn('同步到数据库失败:', result?.error);
            }
        }
        
        // 7. 更新界面
        loadNotes();
        updateCategorySelect();
        updateUsageDisplay();
        
        // 8. 显示恢复成功信息
        const stats = backupData.statistics || {};
        showNotification(`恢复成功！恢复了 ${stats.totalNotes || Object.keys(notes).length} 条笔记，${stats.totalCategories || categories.length} 个分类`, 'success');
        
        console.log('恢复完成:', {
            user: currentUser,
            notes: Object.keys(notes).length,
            categories: categories.length,
            backupDate: backupData.backupDate
        });
        
    } catch (error) {
        console.error('恢复数据失败:', error);
        showNotification('恢复失败: ' + error.message, 'error');
    }
}

// 导入笔记功能
function importNotes() {
    console.log('=== 导入功能已更新 v3 ===');
    importNotesNew();
}

// 新的导入功能
function importNotesNew() {
    console.log('=== 使用新的导入函数 ===');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.md,.txt';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const fileName = file.name.toLowerCase();
                    const fileExtension = fileName.split('.').pop();
                    const fileContent = e.target.result;
                    
                    console.log('文件信息:', {
                        originalName: file.name,
                        fileName: fileName,
                        fileExtension: fileExtension,
                        contentLength: fileContent.length,
                        contentPreview: fileContent.substring(0, 100)
                    });
                    
                    // 强制检查文件扩展名
                    console.log('=== 新函数：判断文件类型 ===', fileExtension);
                    if (fileExtension !== 'json' && fileExtension !== 'md' && fileExtension !== 'txt') {
                        console.log('不支持的文件格式:', fileExtension);
                        showNotification('不支持的文件格式！', 'error');
                        return;
                    }
                    
                    if (fileExtension === 'json') {
                        console.log('=== 新函数：处理 JSON 文件 ===');
                        // 导入 JSON 格式（原有功能）
                        const importData = JSON.parse(fileContent);
                        
                        if (importData.notes && importData.categories) {
                            // 合并数据
                            Object.assign(notes, importData.notes);
                            categories = [...new Set([...categories, ...importData.categories])];
                            
                            saveNotes();
                            saveCategories();
                            loadNotes();
                            updateCategorySelect();
                            
                            // 如果有导入的笔记，选择最新的一个作为最后编辑的笔记
                            if (Object.keys(importData.notes).length > 0) {
                                const latestNote = Object.values(importData.notes).reduce((latest, note) => {
                                    return new Date(note.updatedAt) > new Date(latest.updatedAt) ? note : latest;
                                });
                                localStorage.setItem('lastEditedNote', latestNote.id);
                                lastEditedNote = latestNote.id;
                            }
                            
                            showNotification('JSON 笔记导入成功！', 'success');
                        } else {
                            showNotification('JSON 文件格式不正确！', 'error');
                        }
                    } else if (fileExtension === 'md' || fileExtension === 'txt') {
                        console.log('=== 新函数：处理 MD/TXT 文件 ===', fileExtension);
                        // 导入 MD 或 TXT 格式
                        importMarkdownOrTextFile(fileContent, file.name, fileExtension);
                    } else {
                        showNotification('不支持的文件格式！', 'error');
                    }
                } catch (error) {
                    console.error('导入失败:', error);
                    showNotification('文件解析失败！', 'error');
                }
            };
            reader.readAsText(file, 'UTF-8');
        }
    };
    input.click();
}

// 全新的导入功能 V2
function importNotesV2() {
    console.log('=== 全新导入功能 V2 ===');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.md,.txt';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const fileName = file.name.toLowerCase();
                    const fileExtension = fileName.split('.').pop();
                    const fileContent = e.target.result;
                    
                    console.log('=== V2 文件信息 ===', {
                        originalName: file.name,
                        fileName: fileName,
                        fileExtension: fileExtension,
                        contentLength: fileContent.length,
                        contentPreview: fileContent.substring(0, 100)
                    });
                    
                    // 只处理 TXT 和 MD 文件
                    if (fileExtension === 'txt' || fileExtension === 'md') {
                        console.log('=== V2 处理文本文件 ===', fileExtension);
                        importTextFileV2(fileContent, file.name, fileExtension);
                    } else if (fileExtension === 'json') {
                        console.log('=== V2 处理 JSON 文件 ===');
                        try {
                            const importData = JSON.parse(fileContent);
                            if (importData.notes && importData.categories) {
                                Object.assign(notes, importData.notes);
                                categories = [...new Set([...categories, ...importData.categories])];
                                saveNotes();
                                saveCategories();
                                
                                // 保存到 Supabase 数据库
                                if (typeof saveToSupabase === 'function') {
                                    console.log('开始保存 JSON 导入的笔记到 Supabase...');
                                    saveToSupabase().then((result) => {
                                        console.log('JSON 导入的笔记已保存到 Supabase:', result);
                                    }).catch(error => {
                                        console.error('保存到 Supabase 失败:', error);
                                        showNotification('保存到数据库失败，请检查网络连接', 'error');
                                    });
                                } else {
                                    console.error('saveToSupabase 函数不存在');
                                }
                                
                                loadNotes();
                                updateCategorySelect();
                                showNotification('JSON 笔记导入成功！', 'success');
                            } else {
                                showNotification('JSON 文件格式不正确！', 'error');
                            }
                        } catch (jsonError) {
                            console.error('JSON 解析失败:', jsonError);
                            showNotification('JSON 文件解析失败！', 'error');
                        }
                    } else {
                        showNotification('不支持的文件格式！', 'error');
                    }
                } catch (error) {
                    console.error('V2 导入失败:', error);
                    showNotification('文件导入失败！', 'error');
                }
            };
            reader.readAsText(file, 'UTF-8');
        }
    };
    input.click();
}

// 新的文本文件处理函数
function importTextFileV2(content, fileName, fileExtension) {
    try {
        console.log('=== V2 开始处理文本文件 ===', fileName, fileExtension);
        
        // 从文件名提取标题
        const title = fileName.replace(/\.[^/.]+$/, '');
        console.log('提取的标题:', title);
        
        // 转换内容
        let convertedContent;
        if (fileExtension === 'txt') {
            // 纯文本：将换行符转换为 <br> 标签
            convertedContent = content
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/\n/g, '<br>');
        } else if (fileExtension === 'md') {
            // Markdown：简单的 Markdown 转 HTML
            convertedContent = convertMarkdownToHtmlSimple(content);
        }
        
        console.log('转换后的内容长度:', convertedContent.length);
        
        // 创建新笔记
        const noteId = 'imported_v2_' + Date.now();
        const newNote = {
            id: noteId,
            title: title,
            content: convertedContent,
            category: currentCategory,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            backgroundColor: '#ffffff'
        };
        
        console.log('创建的新笔记:', newNote);
        
        // 添加到笔记列表
        notes[noteId] = newNote;
        
        // 保存并更新界面
        saveNotes();
        
        // 保存到 Supabase 数据库
        if (typeof saveToSupabase === 'function') {
            console.log('开始保存导入的笔记到 Supabase...');
            console.log('当前用户:', localStorage.getItem('notebook_current_user'));
            console.log('Supabase 客户端状态:', supabase ? '已初始化' : '未初始化');
            
            saveToSupabase().then((result) => {
                console.log('导入的笔记已保存到 Supabase:', result);
                if (result && result.success) {
                    showNotification('导入的笔记已保存到数据库', 'success');
                } else {
                    showNotification('保存到数据库失败: ' + (result?.error || '未知错误'), 'error');
                }
            }).catch(error => {
                console.error('保存到 Supabase 失败:', error);
                showNotification('保存到数据库失败，请检查网络连接', 'error');
            });
        } else {
            console.error('saveToSupabase 函数不存在');
        }
        
        loadNotes();
        updateCategorySelect();
        
        // 加载新导入的笔记
        loadNote(noteId);
        
        showNotification(`${fileExtension.toUpperCase()} 文件导入成功！`, 'success');
        
    } catch (error) {
        console.error('V2 文本文件导入失败:', error);
        showNotification('文件导入失败！', 'error');
    }
}

// 导入 Markdown 或文本文件
function importMarkdownOrTextFile(content, fileName, fileExtension) {
    try {
        console.log('开始导入文件:', fileName, '类型:', fileExtension);
        console.log('文件内容长度:', content.length);
        
        // 从文件名提取标题（去掉扩展名）
        const title = fileName.replace(/\.[^/.]+$/, '');
        console.log('提取的标题:', title);
        
        // 转换内容
        const convertedContent = convertMarkdownToHtml(content, fileExtension);
        console.log('转换后的内容长度:', convertedContent.length);
        
        // 创建新笔记
        const noteId = 'imported_' + Date.now();
        const newNote = {
            id: noteId,
            title: title,
            content: convertedContent,
            category: currentCategory,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            backgroundColor: '#ffffff'
        };
        
        console.log('创建的新笔记:', newNote);
        
        // 添加到笔记列表
        notes[noteId] = newNote;
        
        // 保存并更新界面
        saveNotes();
        loadNotes();
        updateCategorySelect();
        
        // 加载新导入的笔记
        loadNote(noteId);
        
        showNotification(`${fileExtension.toUpperCase()} 文件导入成功！`, 'success');
        
    } catch (error) {
        console.error('导入文件失败:', error);
        showNotification('文件导入失败！', 'error');
    }
}

// 将 Markdown 或文本转换为 HTML
function convertMarkdownToHtml(content, fileExtension) {
    if (fileExtension === 'txt') {
        // 纯文本：将换行符转换为 <br> 标签
        return content
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n/g, '<br>');
    } else if (fileExtension === 'md') {
        // Markdown：简单的 Markdown 转 HTML
        return convertMarkdownToHtmlSimple(content);
    }
    return content;
}

// 简单的 Markdown 转 HTML 转换器
function convertMarkdownToHtmlSimple(markdown) {
    let html = markdown;
    
    // 处理标题
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // 处理粗体和斜体
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 处理代码块
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // 处理链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // 处理列表
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>');
    
    // 处理换行
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // 包装段落
    if (!html.startsWith('<')) {
        html = '<p>' + html + '</p>';
    }
    
    return html;
}

// 字体选择器功能
function showFontSelector() {
    document.getElementById('font-selector').style.display = 'block';
    
    // 获取当前选中文本的字体样式
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        
        // 获取当前字体大小
        const computedStyle = window.getComputedStyle(element);
        const fontSize = computedStyle.fontSize;
        const fontFamily = computedStyle.fontFamily;
        const lineHeight = computedStyle.lineHeight;
        
        // 设置选择器的当前值
        document.getElementById('font-size-select').value = fontSize;
        document.getElementById('font-family-select').value = fontFamily;
        document.getElementById('line-height-select').value = parseFloat(lineHeight).toFixed(1);
    }
}

function closeFontSelector() {
    document.getElementById('font-selector').style.display = 'none';
}

function applyFontSize(size) {
    document.execCommand('fontSize', false, '7');
    const fontElements = document.querySelectorAll('font[size="7"]');
    fontElements.forEach(el => {
        el.style.fontSize = size;
        el.removeAttribute('size');
    });
    
    // 触发自动保存
    debouncedAutoSave();
}

function applyFontFamily(fontFamily) {
    if (fontFamily === 'inherit') {
        document.execCommand('removeFormat', false, null);
    } else {
        document.execCommand('fontName', false, fontFamily);
    }
    
    // 触发自动保存
    debouncedAutoSave();
}

function applyLineHeight(lineHeight) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        
        element.style.lineHeight = lineHeight;
    }
    
    // 触发自动保存
    debouncedAutoSave();
}

function applyFontSettings() {
    const fontSize = document.getElementById('font-size-select').value;
    const fontFamily = document.getElementById('font-family-select').value;
    const lineHeight = document.getElementById('line-height-select').value;
    
    // 应用字体大小
    applyFontSize(fontSize);
    
    // 应用字体样式
    applyFontFamily(fontFamily);
    
    // 应用行高
    applyLineHeight(lineHeight);
    
    // 关闭选择器
    closeFontSelector();
    
    // 显示成功提示
    showNotification('字体设置已应用！', 'success');
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
