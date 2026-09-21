// Copyright (c) Cragon. All rights reserved.

namespace UnityEncyclopedia.Primitives.Data
{
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Linq;
    using System.Text;
    
    public sealed class CsvParser : IDisposable
    {
        private Stream _stream;
        private StreamReader _streamReader;
        private Encoding _encoding;
        private Type _type = Type.File;
        private bool _trimColumns = false;
        private char _csvSeparator = ',';

        public bool TrimColumns
        {
            get { return _trimColumns; }
            set { _trimColumns = value; }
        }

        public Type DataSouceType
        {
            get { return _type; }
        }

        public char CsvSeparator
        {
            get { return _csvSeparator; }
            set { _csvSeparator = value; }
        }

        public enum Type
        {
            File,
            Stream
        }

        public CsvParser(string filePath) : this(filePath, Encoding.Default)
        {
        }

        public CsvParser(string filePath, Encoding encoding)
        {
            _type = Type.File;
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException(string.Format("The file '{0}' does not exist.", filePath));
            }
            _stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            _stream.Position = 0;
            _encoding = (encoding ?? Encoding.Default);
            _streamReader = new StreamReader(_stream, _encoding);
        }

        public CsvParser(Stream stream) : this(stream, Encoding.Default)
        {
        }

        public CsvParser(Stream stream, Encoding encoding)
        {
            _type = Type.Stream;
            if (stream == null)
            {
                throw new ArgumentNullException("The supplied stream is null.");
            }
            _stream = stream;
            _stream.Position = 0;
            _encoding = (encoding ?? Encoding.Default);
            _streamReader = new StreamReader(_stream, _encoding);
        }

        public CsvParser(Stream stream, Encoding encoding, char yourSeparator) : this(stream, encoding)
        {
            CsvSeparator = yourSeparator;
        }

        private List<string> ParseLine(string line)
        {
            StringBuilder _columnBuilder = new StringBuilder();
            List<string> Fields = new List<string>();
            bool inColumn = false;
            bool inQuotes = false;
            bool isNotEnd = false;
            _columnBuilder.Remove(0, _columnBuilder.Length);

            for (int i = 0; i < line.Length; i++)
            {
                char character = line[i];

                if (!inColumn)
                {
                    inColumn = true;
                    if (character == '"')
                    {
                        inQuotes = true;
                        continue;
                    }

                    if (inQuotes)
                    {
                        if ((i + 1) == line.Length)
                        {
                            if (character == '"')
                            {
                                inQuotes = false;
                                continue;
                            }
                            else
                            {
                                isNotEnd = true;
                            }
                        }
                        else if (character == '"' && line[i + 1] == _csvSeparator)
                        {
                            inQuotes = false;
                            inColumn = false;
                            i++;
                        }
                        else if (character == '"' && line[i + 1] == '"')
                        {
                            i++;
                        }
                        else if (character == '"')
                        {
                            UnityEngine.Debug.LogError(string.Format("[{0}]: Parse error near [{1}] ", "ParseLine", line));
                            return Fields;
                        }
                    }
                    else if (character == _csvSeparator)
                    {
                        inColumn = false;
                    }

                    if (!inColumn)
                    {
                        Fields.Add(TrimColumns ? _columnBuilder.ToString().Trim() : _columnBuilder.ToString());
                        _columnBuilder.Remove(0, _columnBuilder.Length);
                    }
                    else
                    {
                        _columnBuilder.Append(character);
                    }
                }

                if (inColumn)
                {
                    if (isNotEnd)
                    {
                        _columnBuilder.Append("\r\n");
                    }
                    Fields.Add(TrimColumns ? _columnBuilder.ToString().Trim() : _columnBuilder.ToString());
                }
                else
                {
                    Fields.Add("");
                }
            }

            return Fields;
        }

        private List<string> ParseContinueLine(string line)
        {
            StringBuilder _columnBuilder = new StringBuilder();
            List<string> Fields = new List<string>();
            _columnBuilder.Remove(0, _columnBuilder.Length);
            if (line == "")
            {
                Fields.Add("\r\n");
                return Fields;
            }

            for (int i = 0; i < line.Length; i++)
            {
                char character = line[i];

                if ((i + 1) == line.Length)
                {
                    if (character == '"')
                    {
                        Fields.Add(TrimColumns ? _columnBuilder.ToString().TrimEnd() : _columnBuilder.ToString());
                        return Fields;
                    }
                    else
                    {
                        _columnBuilder.Append("\r\n");
                        Fields.Add(_columnBuilder.ToString());
                        return Fields;
                    }
                }
                else if (character == '"' && line[i + 1] == _csvSeparator)
                {
                    Fields.Add(TrimColumns ? _columnBuilder.ToString().TrimEnd() : _columnBuilder.ToString());
                    i++;
                    Fields.AddRange(ParseLine(line.Remove(0, i + 1)));
                    break;
                }
                else if (character == '"' && line[i + 1] == '"')
                {
                    i++;
                }
                else if (character == '"')
                {
                    throw new Exception(string.Format("[{0}]: Parse error near [{1}]", "ParseContinueLine", line));
                }
                _columnBuilder.Append(character);
            }
            return Fields;
        }

        public List<List<string>> GetListCsvData()
        {
            _stream.Position = 0;
            List<List<string>> tempListCsvData = new List<List<string>>();
            bool isNotEndLine = false;
            string tempCsvRowString = _streamReader.ReadLine();
            
            while (tempCsvRowString != null)
            {
                List<string> tempCsvRowList;
                if (isNotEndLine)
                {
                    tempCsvRowList = ParseContinueLine(tempCsvRowString);
                    isNotEndLine = (tempCsvRowList.Count > 0 && tempCsvRowList[tempCsvRowList.Count - 1].EndsWith("\r\n"));
                    List<string> myNowContinueList = tempListCsvData[tempListCsvData.Count - 1];
                    myNowContinueList[myNowContinueList.Count - 1] += tempCsvRowList[0];
                    tempCsvRowList.RemoveAt(0);
                    myNowContinueList.AddRange(tempCsvRowList);
                }
                else
                {
                    tempCsvRowList = ParseLine(tempCsvRowString);
                    isNotEndLine = (tempCsvRowList.Count > 0 && tempCsvRowList[tempCsvRowList.Count - 1].EndsWith("\r\n"));
                    tempListCsvData.Add(tempCsvRowList);
                }

                tempCsvRowString = _streamReader.ReadLine();
            }

            return tempListCsvData;
        }

        public void Dispose()
        {
            if (_streamReader != null)
            {
                _streamReader.Dispose();
            }
            if (_stream != null)
            {
                _stream.Dispose();
            }
        }

        static CsvParser()
        {
            isSaveAsExcel = true;
            defaultEncoding = new System.Text.UTF8Encoding(false);
        }

        private static bool isSaveAsExcel;
        private static Encoding defaultEncoding;
        private static char csvSeparator = ',';

        public static char DefaultCsvSeparator
        {
            get { return csvSeparator; }
            set { csvSeparator = value; }
        }

        public static bool IsSaveAsExcel
        {
            get { return isSaveAsExcel; }
            set { isSaveAsExcel = value; }
        }

        public static Encoding DefaultEncoding
        {
            get { return defaultEncoding; }
            set { defaultEncoding = value; }
        }

        private static void WriteCsvVeiw(List<List<string>> yourListCsvData, TextWriter writer)
        {
            foreach (List<string> tempField in yourListCsvData)
            {
                WriteCsvLine(tempField, writer);
            }
        }

        private static void WriteCsvLine(List<string> fields, TextWriter writer)
        {
            StringBuilder myStrBld = new StringBuilder();
            
            for (int i = 0; i < fields.Count; i++)
            {
                if (fields[i] == null)
                {
                    myStrBld.Append("");
                }
                else
                {
                    bool quotesRequired = (isSaveAsExcel ? (fields[i].Contains(csvSeparator.ToString()) || fields[i].Contains("\r\n") || fields[i].Contains("\"")) : (fields[i].Contains(csvSeparator.ToString()) || fields[i].Contains("\r\n") || fields[i].StartsWith("\"")));
                    if (quotesRequired)
                    {
                        if (fields[i].Contains("\""))
                        {
                            myStrBld.Append(String.Format("\"{0}\"", fields[i].Replace("\"", "\"\"")));
                        }
                        else
                        {
                            myStrBld.Append(String.Format("\"{0}\"", fields[i]));
                        }
                    }
                    else
                    {
                        myStrBld.Append(fields[i]);
                    }
                }

                if (i < fields.Count - 1)
                {
                    myStrBld.Append(csvSeparator);
                }
            }
            writer.WriteLine(myStrBld.ToString());
        }

        public static void SaveCsvFile(string yourFilePath, List<List<string>> yourDataSouse, bool isAppend, Encoding yourEncode)
        {
            if (isAppend && !File.Exists(yourFilePath))
            {
                throw new Exception("in Append mode the FilePath must exist");
            }
            if (!isAppend && !File.Exists(yourFilePath))
            {
                if (yourFilePath.Contains('\\'))
                {
                    if (!Directory.Exists(yourFilePath.Remove(yourFilePath.LastIndexOf('\\'))))
                    {
                        throw new Exception("the FilePath or the Directory it not exist");
                    }
                }
            }
            
            StreamWriter myCsvSw = new StreamWriter(new FileStream(yourFilePath, isAppend ? FileMode.Append : FileMode.Create, FileAccess.Write, FileShare.ReadWrite), yourEncode);
            if (yourDataSouse == null)
            {
                throw new Exception("your DataSouse is null");
            }
            WriteCsvVeiw(yourDataSouse, myCsvSw);
            myCsvSw.Dispose();
        }

        public static void SaveCsvFile(string yourFilePath, List<List<string>> yourDataSouse)
        {
            SaveCsvFile(yourFilePath, yourDataSouse, false, defaultEncoding);
        }

        public static Stream OpenFile(string filePath)
        {
            Stream myStream;
            try
            {
                myStream = new FileStream(filePath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            }
            catch (Exception)
            {
                return null;
            }
            return myStream;
        }
    }
}
