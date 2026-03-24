import React, { useState, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Papa from 'papaparse';
import { Upload, FileDown, Search, AlertCircle, CheckCircle2, Loader2, XCircle, LogOut, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

interface CsvRow {
  vatNumber: string;
}

interface PeppolMatch {
  participantId: string;
  companyName: string | null;
  countryCode: string | null;
}

interface ProcessedResult {
  vatNumber: string;
  matches: PeppolMatch[];
  status: 'pending' | 'success' | 'not_found' | 'error';
  errorMessage?: string;
}

function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isCancelledRef = useRef<boolean>(false);
  const { user, logout } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please upload a valid CSV file.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResults([]);
      setProgress(0);
    }
  };

  const cancelProcessing = () => {
    isCancelledRef.current = true;
    setIsProcessing(false);
  };

  const processCsv = () => {
    if (!file) return;

    setIsProcessing(true);
    isCancelledRef.current = false;
    setError(null);
    setResults([]);
    setProgress(0);

    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        if (data.length === 0) {
          setError('The CSV file is empty.');
          setIsProcessing(false);
          return;
        }

        let startIndex = 0;
        const firstCell = data[0][0]?.trim().toLowerCase();
        if (firstCell === 'vat' || firstCell === 'tva' || firstCell === 'vat number' || firstCell === 'numero de tva') {
          startIndex = 1;
        }

        const vatNumbers = data.slice(startIndex).map(row => row[0]?.trim()).filter(Boolean);
        
        if (vatNumbers.length === 0) {
          setError('No valid VAT numbers found in the first column.');
          setIsProcessing(false);
          return;
        }

        const initialResults: ProcessedResult[] = vatNumbers.map(vat => ({
          vatNumber: vat,
          matches: [],
          status: 'pending'
        }));

        setResults(initialResults);

        for (let i = 0; i < vatNumbers.length; i++) {
          if (isCancelledRef.current) {
            break;
          }
          
          const vat = vatNumbers[i];
          
          try {
            let cleanedVat = vat.replace(/\s+/g, '');
            if (cleanedVat.toUpperCase().startsWith('BE')) {
              cleanedVat = cleanedVat.substring(2);
            }
            const searchQuery = encodeURIComponent(cleanedVat);
            const response = await fetch(`/api/peppol/search?q=${searchQuery}`);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            setResults(prev => {
              const newResults = [...prev];
              
              if (data.matches && data.matches.length > 0) {
                const matches = data.matches.map((match: any) => ({
                  participantId: match.participantID?.value || '',
                  companyName: match.entities?.[0]?.name?.[0]?.name || null,
                  countryCode: match.entities?.[0]?.countryCode || null,
                })).filter((m: PeppolMatch) => m.participantId);
                
                newResults[i] = {
                  ...newResults[i],
                  matches,
                  status: matches.length > 0 ? 'success' : 'not_found'
                };
              } else {
                newResults[i] = {
                  ...newResults[i],
                  matches: [],
                  status: 'not_found'
                };
              }
              return newResults;
            });
          } catch (err) {
            console.error(`Error processing VAT ${vat}:`, err);
            setResults(prev => {
              const newResults = [...prev];
              newResults[i] = {
                ...newResults[i],
                status: 'error',
                errorMessage: err instanceof Error ? err.message : 'Unknown error'
              };
              return newResults;
            });
          }
          
          setProgress(Math.round(((i + 1) / vatNumbers.length) * 100));
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        setIsProcessing(false);
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`);
        setIsProcessing(false);
      }
    });
  };

  const downloadResults = () => {
    if (results.length === 0) return;

    const csvData = results.flatMap(r => {
      if (r.matches.length === 0) {
        return [{
          'VAT Number': r.vatNumber,
          'Participant ID': '',
          'Company Name': '',
          'Country Code': '',
          'Status': r.status
        }];
      }
      return r.matches.map(m => ({
        'VAT Number': r.vatNumber,
        'Participant ID': m.participantId,
        'Company Name': m.companyName || '',
        'Country Code': m.countryCode || '',
        'Status': r.status
      }));
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'peppol_participant_ids.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.type !== 'text/csv' && !droppedFile.name.endsWith('.csv')) {
        setError('Please upload a valid CSV file.');
        return;
      }
      setFile(droppedFile);
      setError(null);
      setResults([]);
      setProgress(0);
    }
  };

  const getStatusBadge = (status: ProcessedResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Found</Badge>;
      case 'not_found':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200"><AlertCircle className="w-3 h-3 mr-1" /> Not Found</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-gray-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col">
      <div className="max-w-7xl mx-auto space-y-6 flex-1 w-full flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 leading-tight">Peppol Directory Lookup</h1>
            <p className="text-gray-500 mt-1">Upload a CSV of VAT numbers to find their Peppol Participant IDs.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-3 rounded-lg shadow-sm border">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-full">
                <UserIcon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-gray-700 max-w-[150px] truncate">
                {user?.email}
              </span>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout}
              className="text-gray-500 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
          <Card className="md:col-span-1 h-fit">
            <CardHeader>
              <CardTitle>Upload CSV</CardTitle>
              <CardDescription>
                The CSV should contain VAT numbers in the first column.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${file ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary/50'}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-4" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-900">Click or drag file to this area to upload</p>
                    <p className="text-xs text-gray-500 mt-1">CSV files only</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <div className="flex w-full gap-2">
                <Button 
                  className="flex-1" 
                  onClick={processCsv} 
                  disabled={!file || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Lookup Participant IDs
                    </>
                  )}
                </Button>
                
                {isProcessing && (
                  <Button 
                    variant="destructive" 
                    onClick={cancelProcessing}
                    className="flex-none"
                    title="Cancel processing"
                  >
                    <XCircle className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Cancel</span>
                  </Button>
                )}
              </div>
              
              {isProcessing && (
                <div className="w-full space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </CardFooter>
          </Card>

          <Card className="md:col-span-2 flex flex-col h-[calc(100vh-12rem)] min-h-[600px]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  {results.length > 0 ? `Processed ${results.filter(r => r.status !== 'pending').length} of ${results.length} VAT numbers` : 'No results yet'}
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={downloadResults}
                disabled={results.length === 0 || isProcessing}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              {results.length > 0 ? (
                <ScrollArea className="h-full border-t">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[150px]">VAT Number</TableHead>
                        <TableHead>Participant ID</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.flatMap((result, resultIndex) => {
                        if (result.matches.length === 0) {
                          return [
                            <TableRow key={`empty-${resultIndex}`}>
                              <TableCell className="font-medium align-top">{result.vatNumber}</TableCell>
                              <TableCell className="font-mono text-sm align-top">-</TableCell>
                              <TableCell className="align-top">-</TableCell>
                              <TableCell className="align-top">{getStatusBadge(result.status)}</TableCell>
                            </TableRow>
                          ];
                        }
                        
                        return result.matches.map((match, matchIndex) => (
                          <TableRow key={`${resultIndex}-${matchIndex}`}>
                            {matchIndex === 0 && (
                              <TableCell className="font-medium align-top" rowSpan={result.matches.length}>
                                {result.vatNumber}
                              </TableCell>
                            )}
                            <TableCell className="font-mono text-sm align-top">{match.participantId}</TableCell>
                            <TableCell className="align-top">
                              {match.companyName ? (
                                <div className="flex flex-col">
                                  <span>{match.companyName}</span>
                                  {match.countryCode && <span className="text-xs text-gray-500">{match.countryCode}</span>}
                                </div>
                              ) : '-'}
                            </TableCell>
                            {matchIndex === 0 && (
                              <TableCell className="align-top" rowSpan={result.matches.length}>
                                {getStatusBadge(result.status)}
                              </TableCell>
                            )}
                          </TableRow>
                        ));
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6 border-t">
                  <Search className="w-12 h-12 text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-900">No data to display</p>
                  <p className="text-sm text-center mt-1">Upload a CSV file and click "Lookup Participant IDs" to see results here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}
