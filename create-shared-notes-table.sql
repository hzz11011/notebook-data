-- 创建分享笔记表
CREATE TABLE IF NOT EXISTS shared_notes (
    id VARCHAR(8) PRIMARY KEY,
    note_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    access_count INTEGER DEFAULT 0
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shared_notes_expires_at ON shared_notes(expires_at);
CREATE INDEX IF NOT EXISTS idx_shared_notes_created_at ON shared_notes(created_at);

-- 启用行级安全
ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取未过期的分享
CREATE POLICY "Allow read access to non-expired shared notes" ON shared_notes
    FOR SELECT USING (expires_at > NOW());

-- 创建策略：允许插入新的分享
CREATE POLICY "Allow insert for shared notes" ON shared_notes
    FOR INSERT WITH CHECK (true);

-- 创建策略：允许更新访问计数
CREATE POLICY "Allow update access count" ON shared_notes
    FOR UPDATE USING (true) WITH CHECK (true);

-- 创建自动清理过期分享的函数
CREATE OR REPLACE FUNCTION cleanup_expired_shared_notes()
RETURNS void AS $$
BEGIN
    DELETE FROM shared_notes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 创建增加访问计数的函数
CREATE OR REPLACE FUNCTION increment_access_count(share_id VARCHAR(8))
RETURNS void AS $$
BEGIN
    UPDATE shared_notes 
    SET access_count = access_count + 1 
    WHERE id = share_id;
END;
$$ LANGUAGE plpgsql;

-- 创建定时任务（需要 pg_cron 扩展）
-- SELECT cron.schedule('cleanup-expired-shares', '0 2 * * *', 'SELECT cleanup_expired_shared_notes();');

-- 手动清理过期分享（可以定期执行）
-- SELECT cleanup_expired_shared_notes();
