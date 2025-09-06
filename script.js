// 全局变量
let currentNote = null;
let notes = JSON.parse(localStorage.getItem('notes')) || {};
let categories = JSON.parse(localStorage.getItem('categories')) || ['默认'];
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

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // 初始化 Supabase
    setTimeout(async () => {
        if (initializeSupabase()) {
            // 初始化 Supabase 数据库表
            initializeSupabaseTables();
            
            // 优先从 Supabase 加载数据，覆盖本地数据
            console.log('正在从 Supabase 加载最新数据...');
            
            // 清除本地存储，确保完全从数据库加载
            localStorage.removeItem('notes');
            localStorage.removeItem('categories');
            localStorage.removeItem('lastEditedNote');
            
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
            <div class="category-toggle" onclick="toggleCategory('${categoryName}')">
                <i class="fas fa-chevron-down"></i>
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

// 从下拉菜单选择分类
function selectCategoryFromDropdown(categoryName) {
    updateCategoryDisplay(categoryName);
    
    // 触发分类变更事件
    handleCategoryChange();
}

// 保存分类数据
function saveCategories() {
    localStorage.setItem('categories', JSON.stringify(categories));
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
        for (const [noteId, note] of Object.entries(notes)) {
            const { error } = await supabase
                .from('notes')
                .upsert({
                    id: noteId,
                    title: note.title,
                    content: note.content,
                    category: note.category,
                    background_color: note.backgroundColor,
                    created_at: note.createdAt,
                    updated_at: note.updatedAt
                });
            
            if (error) {
                console.error('保存笔记失败:', noteId, error);
            }
        }
        
        // 保存分类
        const { error: categoryError } = await supabase
            .from('categories')
            .upsert({
                id: 'default',
                categories: categories,
                theme: currentTheme,
                last_edited_note: lastEditedNote,
                updated_at: new Date().toISOString()
            });
        
        if (categoryError) {
            console.error('保存分类失败:', categoryError);
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
    localStorage.removeItem('notes');
    localStorage.removeItem('categories');
    localStorage.removeItem('lastEditedNote');
    
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
        const { data: notesData, error: notesError } = await supabase
            .from('notes')
            .select('*');
        
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
            .eq('id', 'default')
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
        localStorage.setItem('lastEditedNote', lastEditedNote);
        
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
        
        // 获取数据库大小（通过 Supabase 系统表查询）
        let dbSize = '未知';
        let dbSizeBytes = 0;
        try {
            // 查询数据库大小
            const { data: sizeData, error: sizeError } = await supabase
                .rpc('get_database_size');
            
            if (!sizeError && sizeData) {
                // 如果 RPC 函数存在，使用它
                dbSizeBytes = parseFloat(sizeData);
                if (dbSizeBytes < 1024) {
                    dbSize = `${dbSizeBytes} B`;
                } else if (dbSizeBytes < 1024 * 1024) {
                    dbSize = `${(dbSizeBytes / 1024).toFixed(1)} KB`;
                } else if (dbSizeBytes < 1024 * 1024 * 1024) {
                    dbSize = `${(dbSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
                } else {
                    dbSize = `${(dbSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
                }
            } else {
                // 如果 RPC 函数不存在，使用 SQL 查询
                const { data: sqlData, error: sqlError } = await supabase
                    .from('pg_database_size')
                    .select('*')
                    .limit(1);
                
                if (!sqlError && sqlData) {
                    dbSizeBytes = parseFloat(sqlData[0]?.size || 0);
                    if (dbSizeBytes < 1024) {
                        dbSize = `${dbSizeBytes} B`;
                    } else if (dbSizeBytes < 1024 * 1024) {
                        dbSize = `${(dbSizeBytes / 1024).toFixed(1)} KB`;
                    } else if (dbSizeBytes < 1024 * 1024 * 1024) {
                        dbSize = `${(dbSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
                    } else {
                        dbSize = `${(dbSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
                    }
                } else {
                    // 如果都失败，使用本地计算作为备选
                    const allNotes = Object.values(notes);
                    let totalSize = 0;
                    
                    allNotes.forEach(note => {
                        const noteJson = JSON.stringify(note);
                        totalSize += new Blob([noteJson]).size;
                    });
                    
                    const categoriesJson = JSON.stringify(categories);
                    totalSize += new Blob([categoriesJson]).size;
                    
                    dbSizeBytes = totalSize;
                    if (totalSize < 1024) {
                        dbSize = `${totalSize} B`;
                    } else if (totalSize < 1024 * 1024) {
                        dbSize = `${(totalSize / 1024).toFixed(1)} KB`;
                    } else {
                        dbSize = `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
                    }
                }
            }
        } catch (error) {
            console.error('获取数据库大小失败:', error);
            dbSize = '获取失败';
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
    
    // 计算使用率（假设 500MB 限制）
    const totalLimitBytes = 500 * 1024 * 1024; // 500MB 转换为字节
    const currentSizeBytes = usage.dbSizeBytes || 0;
    const usagePercentage = Math.min((currentSizeBytes / totalLimitBytes) * 100, 100);
    
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

// 清理数据库中的孤立记录
async function cleanupOrphanedRecords() {
    if (!supabase) {
        showNotification('Supabase 未初始化，无法清理', 'error');
        return;
    }
    
    showNotification('正在清理数据库中的孤立记录...', 'info');
    
    try {
        // 获取数据库中的所有笔记
        const { data: dbNotes, error: fetchError } = await supabase
            .from('notes')
            .select('id');
        
        if (fetchError) {
            console.error('获取数据库笔记失败:', fetchError);
            showNotification('清理失败: ' + fetchError.message, 'error');
            return;
        }
        
        // 找出本地不存在的笔记ID
        const localNoteIds = Object.keys(notes);
        const orphanedIds = dbNotes
            .map(note => note.id)
            .filter(id => !localNoteIds.includes(id));
        
        if (orphanedIds.length === 0) {
            showNotification('没有发现孤立记录', 'info');
            return;
        }
        
        // 删除孤立记录
        const { error: deleteError } = await supabase
            .from('notes')
            .delete()
            .in('id', orphanedIds);
        
        if (deleteError) {
            console.error('删除孤立记录失败:', deleteError);
            showNotification('清理失败: ' + deleteError.message, 'error');
        } else {
            showNotification(`已清理 ${orphanedIds.length} 条孤立记录`, 'success');
            console.log('清理的孤立记录ID:', orphanedIds);
        }
        
        // 刷新使用量显示
        updateUsageDisplay();
        
    } catch (error) {
        console.error('清理孤立记录时出错:', error);
        showNotification('清理失败: ' + error.message, 'error');
    }
}

// 测试删除功能
async function testDeleteFunction() {
    if (!supabase) {
        showNotification('Supabase 未初始化', 'error');
        return;
    }
    
    console.log('=== 测试删除功能 ===');
    
    try {
        // 1. 检查 Supabase 连接
        console.log('1. 检查 Supabase 连接...');
        const { data: testData, error: testError } = await supabase
            .from('notes')
            .select('id')
            .limit(1);
        
        if (testError) {
            console.error('Supabase 连接测试失败:', testError);
            showNotification(`连接测试失败: ${testError.message}`, 'error');
            return;
        }
        
        console.log('Supabase 连接正常');
        
        // 2. 检查 RLS 策略
        console.log('2. 检查 RLS 策略...');
        const { data: allNotes, error: selectError } = await supabase
            .from('notes')
            .select('*');
        
        if (selectError) {
            console.error('查询笔记失败:', selectError);
            showNotification(`查询失败: ${selectError.message}`, 'error');
            
            if (selectError.code === 'PGRST301') {
                showNotification('权限不足，请检查 Supabase RLS 策略设置', 'error');
            }
            return;
        }
        
        console.log('查询成功，找到笔记数量:', allNotes.length);
        
        // 3. 测试删除权限
        if (allNotes.length > 0) {
            console.log('3. 测试删除权限...');
            const testNoteId = allNotes[0].id;
            console.log('测试删除笔记ID:', testNoteId);
            
            const { data: deleteData, error: deleteError } = await supabase
                .from('notes')
                .delete()
                .eq('id', testNoteId)
                .select();
            
            if (deleteError) {
                console.error('删除测试失败:', deleteError);
                showNotification(`删除测试失败: ${deleteError.message}`, 'error');
                
                if (deleteError.code === 'PGRST301') {
                    showNotification('删除权限不足，请检查 Supabase RLS 策略', 'error');
                }
            } else {
                console.log('删除测试成功:', deleteData);
                showNotification('删除功能正常！', 'success');
                
                // 重新创建测试笔记
                const { error: insertError } = await supabase
                    .from('notes')
                    .insert([allNotes[0]]);
                
                if (insertError) {
                    console.error('恢复测试笔记失败:', insertError);
                } else {
                    console.log('测试笔记已恢复');
                }
            }
        } else {
            showNotification('没有笔记可以测试删除功能', 'info');
        }
        
    } catch (error) {
        console.error('测试删除功能时出错:', error);
        showNotification(`测试失败: ${error.message}`, 'error');
    }
    
    console.log('=== 测试完成 ===');
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
            localStorage.setItem('lastEditedNote', lastEditedNote);
            
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
                localStorage.setItem('lastEditedNote', lastEditedNote);
                
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
    
    notes[noteId] = newNote;
    currentNote = noteId;
    
    // 保存为最后编辑的笔记
    localStorage.setItem('lastEditedNote', noteId);
    lastEditedNote = noteId;
    
    // 清空并更新UI
    document.getElementById('note-title').value = '新笔记';
    document.getElementById('editor').innerHTML = '';
    
    // 更新分类显示
    updateCategoryDisplay(currentCategory);
    
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
    localStorage.setItem('lastEditedNote', noteId);
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
    
    // 不更新左侧分类选择状态，保持用户之前选择的分类
    // 右侧下拉框显示当前笔记的分类，左侧保持用户选择的分类
    
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
    localStorage.setItem('notes', JSON.stringify(notes));
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
function handleShareUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareData = urlParams.get('share');
    
    if (shareData) {
        try {
            const noteData = JSON.parse(decodeURIComponent(shareData));
            
            // 创建新笔记
            const noteId = 'shared_' + Date.now();
            const newNote = {
                id: noteId,
                title: noteData.title || '分享的笔记',
                content: noteData.content || '',
                category: noteData.category || '默认',
                createdAt: noteData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                backgroundColor: '#ffffff'
            };
            
            notes[noteId] = newNote;
            saveNotes();
            
            // 加载笔记
            loadNote(noteId);
            loadNotes();
            
            showNotification('已导入分享的笔记！', 'success');
            
            // 清除URL参数
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
            console.error('解析分享数据失败:', error);
            showNotification('分享链接无效！', 'error');
        }
    }
}

// 页面加载完成后处理分享链接
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(handleShareUrl, 1000);
});

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

// 导入笔记功能
function importNotes() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importData = JSON.parse(e.target.result);
                    
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
                        
                        showNotification('笔记导入成功！', 'success');
                    } else {
                        showNotification('文件格式不正确！', 'error');
                    }
                } catch (error) {
                    console.error('导入失败:', error);
                    showNotification('文件解析失败！', 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
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
