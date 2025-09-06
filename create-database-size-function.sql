-- 在 Supabase 中创建获取数据库大小的 RPC 函数
-- 请在 Supabase Dashboard 的 SQL Editor 中执行以下语句

-- 创建获取数据库大小的函数
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    db_size numeric;
BEGIN
    -- 获取当前数据库的大小（以字节为单位）
    SELECT pg_database_size(current_database()) INTO db_size;
    
    -- 返回大小（以字节为单位）
    RETURN db_size;
END;
$$;

-- 授予匿名用户执行权限
GRANT EXECUTE ON FUNCTION get_database_size() TO anon;
GRANT EXECUTE ON FUNCTION get_database_size() TO authenticated;

-- 测试函数
SELECT get_database_size() as database_size_bytes;
