@echo off
chcp 65001 >nul
echo.
echo ========================================
echo           网络记事本启动器
echo ========================================
echo.
echo 正在启动网络记事本...
echo.

REM 检查是否存在index.html文件
if not exist "index.html" (
    echo 错误：找不到index.html文件！
    echo 请确保所有文件都在同一目录下。
    pause
    exit /b 1
)

REM 尝试使用默认浏览器打开
start "" "index.html"

echo 网络记事本已在浏览器中打开！
echo.
echo 如果浏览器没有自动打开，请手动打开index.html文件。
echo.
echo 按任意键退出...
pause >nul
