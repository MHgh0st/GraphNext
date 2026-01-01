
echo "⏳ Waiting for 5 seconds to ensure Database is ready..."
sleep 5

echo "🚀 Running Import Script..."
python import_data.py

if [ $? -eq 0 ]; then
    echo "✅ Import finished. Starting Uvicorn..."
    exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "❌ Import failed!"
    exit 1
fi